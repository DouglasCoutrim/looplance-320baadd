"""
© 2026 Looplance. All Rights Reserved.
Developed & Patented by Douglas Coutrim Silva.

Looplance Edge Agent
=====================
Roda como serviço systemd (looplance-edge.service). Ver systemd/ e install.sh.

Responsabilidades:
   1. Para cada câmera ativa do device: manter um buffer circular EM RAM
      (tmpfs) dos últimos `buffer_seconds` via ffmpeg segment muxer.
   2. Escutar a(s) botoeira(s) física(s); ao clique, montar o replay
      (concat + trim + overlay), subir pro R2 e registrar no backend.
   3. Enviar heartbeat periódico (status online, uptime, ip local, versão).
   4. Reportar status de streaming de cada câmera (online/offline/erro).
   5. Se qualquer câmera cair, reconectar automaticamente (o próprio ffmpeg
      falha -> watchdog reinicia o processo); se o processo inteiro morrer,
      o systemd (Restart=always) reinicia o serviço -- nada depende de
      intervenção manual, inclusive após reboot da máquina (systemd enable).
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import signal
import socket
import subprocess
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import shutil

import httpx

import api_client
import config as cfg
from clip_builder import ClipBuildError, build_clip
from live_streamer import LiveStreamer
from ram_buffer import CameraBuffer
from trigger import start_trigger_listener
from uploader import upload_clip


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("looplance.main")

START_TIME = time.time()
_shutdown = threading.Event()
SPONSOR_DIR = Path("/opt/looplance-edge/sponsors")
SPONSOR_CACHE_DIR = SPONSOR_DIR


def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:  # noqa: BLE001
        return "127.0.0.1"
    finally:
        s.close()


class EdgeAgent:
    def __init__(self, settings: cfg.Settings):
        self.settings = settings
        self.buffers: dict[str, CameraBuffer] = {}
        self.livers: dict[str, LiveStreamer] = {}
        self._camera_configs: dict[str, str] = {}
        self._executor = ThreadPoolExecutor(max_workers=2)

    @staticmethod
    def _camera_config_hash(camera: cfg.CameraConfig) -> str:
        raw = json.dumps({
            "rtsp_url": camera.rtsp_url,
            "stream_protocol": camera.stream_protocol,
            "buffer_seconds": camera.buffer_seconds,
            "replay_seconds": camera.replay_seconds,
            "active": camera.active,
            "rtmp_stream_key": camera.rtmp_stream_key,
            "protocol_settings": camera.protocol_settings,
        }, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()

    # -- boot ------------------------------------------------------------

    def start(self) -> None:
        log.info("iniciando %d câmera(s) em buffer RAM", len(self.settings.cameras))
        for cam in self.settings.cameras:
            buf = CameraBuffer(self.settings, cam)
            buf.start()
            self.buffers[cam.id] = buf
            live = LiveStreamer(self.settings, cam)
            try:
                live.start()
                self.livers[cam.id] = live
            except Exception:  # noqa: BLE001
                log.exception("[%s] falha ao iniciar live HLS", cam.name)
            self._camera_configs[cam.id] = self._camera_config_hash(cam)

        self._sync_sponsors()

        start_trigger_listener(self._on_trigger, self._input_boards())

        threading.Thread(target=self._heartbeat_loop, daemon=True).start()
        threading.Thread(target=self._health_loop, daemon=True).start()
        threading.Thread(target=self._manual_trigger_loop, daemon=True).start()
        threading.Thread(target=self._config_refresh_loop, daemon=True).start()

    def stop(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
        for buf in self.buffers.values():
            buf.stop()
        for live in self.livers.values():
            live.stop()

    def _input_boards(self) -> list[dict]:
        # A config remota pode trazer input_boards; se não vier explicitamente
        # aqui, o trigger.py escuta todos os teclados USB disponíveis.
        return getattr(self.settings, "input_boards", [])

    # -- trigger -----------------------------------------------------------

    def _on_trigger(self, local_key: str) -> None:
        log.info("[trigger] BOTAO FISICO pressionado: %s", local_key)
        log.info("[trigger] cameras disponiveis: %s",
                 [{"id": c.id, "name": c.name, "trigger_button": c.trigger_button} for c in self.settings.cameras])
        cam = next((c for c in self.settings.cameras if c.trigger_button == local_key), None)
        if not cam:
            log.warning("[trigger] botao %s — nenhuma camera com trigger_button=%s", local_key, local_key)
            return
        log.info("[trigger] botao %s -> camera %s (%s) arena=%s", local_key, cam.name, cam.id, cam.arena_id)
        self._executor.submit(self._handle_replay, cam)

    def _trigger_by_camera_id(self, camera_id: str) -> None:
        log.info("[trigger] _trigger_by_camera_id chamado com camera_id=%s", camera_id)
        log.info("[trigger] cameras disponiveis: %s", [{"id": c.id, "name": c.name, "arena_id": c.arena_id} for c in self.settings.cameras])

        cam = next((c for c in self.settings.cameras if c.id == camera_id), None)
        if not cam:
            log.info("[trigger] camera %s desconhecida localmente, recarregando config remota...", camera_id)
            try:
                cfg.fetch_remote_config(self.settings)
                self._sync_buffers()
                log.info("[trigger] config remota recarregada. cameras agora: %s", [{"id": c.id, "name": c.name} for c in self.settings.cameras])
            except Exception:  # noqa: BLE001
                log.exception("[trigger] falha ao recarregar config remota")
                return
            cam = next((c for c in self.settings.cameras if c.id == camera_id), None)
            if not cam:
                log.warning("[trigger] camera %s continua indisponivel APOS refresh remoto", camera_id)
                return
            log.info("[trigger] camera %s (%s) encontrada apos refresh remoto", cam.name, camera_id)
        else:
            log.info("[trigger] camera encontrada localmente: %s (%s) arena=%s replay_seconds=%s",
                     cam.name, cam.id, cam.arena_id, cam.replay_seconds)

        log.info("[trigger] despachando _handle_replay para camera %s (%s)", cam.name, camera_id)
        self._executor.submit(self._handle_replay, cam)

    def _sync_buffers(self) -> None:
        """Garante buffer + live HLS para cada câmera ativa; encerra as removidas.
        Detecta alterações de configuração (protocolo, URL, etc.) e reinicia
        o processo do FFmpeg dinamicamente sem derrubar o serviço principal.
        """
        active_ids = {c.id for c in self.settings.cameras}
        for cid in list(self.buffers.keys()):
            if cid not in active_ids:
                log.info("removendo buffer da câmera %s (não está mais ativa)", cid)
                self.buffers.pop(cid).stop()
                live = self.livers.pop(cid, None)
                if live:
                    live.stop()
                self._camera_configs.pop(cid, None)
        for cam in self.settings.cameras:
            new_hash = self._camera_config_hash(cam)
            old_hash = self._camera_configs.get(cam.id)
            if old_hash is not None and old_hash != new_hash:
                log.info(
                    "[%s] config alterada (protocolo/URL), reiniciando buffer...",
                    cam.name,
                )
                if cam.id in self.buffers:
                    self.buffers.pop(cam.id).stop()
                live = self.livers.pop(cam.id, None)
                if live:
                    live.stop()
                old_hash = None
            if cam.id not in self.buffers or old_hash is None:
                log.info("iniciando buffer da câmera %s (%s)", cam.name, cam.id)
                buf = CameraBuffer(self.settings, cam)
                buf.start()
                self.buffers[cam.id] = buf
                live = LiveStreamer(self.settings, cam)
                try:
                    live.start()
                    self.livers[cam.id] = live
                except Exception:  # noqa: BLE001
                    log.exception("[%s] falha ao iniciar live HLS", cam.name)
            self._camera_configs[cam.id] = new_hash

    def _handle_replay(self, cam: cfg.CameraConfig) -> None:
        log.info("=" * 60)
        log.info("=== HANDLE REPLAY ===")
        log.info("Camera Name .......: %s", cam.name)
        log.info("Camera ID .........: %s", cam.id)
        log.info("Arena ID ..........: %s", cam.arena_id)
        log.info("Quadra ID .........: %s", cam.quadra_id)
        log.info("Replay Seconds ....: %s", cam.replay_seconds)
        log.info("Buffer Seconds ....: %s", cam.buffer_seconds)
        log.info("Trigger Button ....: %s", cam.trigger_button)
        log.info("=" * 60)

        try:
            buf = self.buffers.get(cam.id)
            if not buf:
                log.error("[%s] SEM BUFFER ATIVO — buffers disponiveis: %s",
                          cam.name, list(self.buffers.keys()))
                return

            replay_id = str(uuid.uuid4())
            log.info("[%s] replay_id=%s | buscando segmentos (buffer_seconds=%s)...",
                     cam.name, replay_id, cam.buffer_seconds)
            log.info("[%s] buffer status=%s alive=%s segments=%d error=%s",
                     cam.name, buf.last_status, buf.is_alive(), len(buf._segments),
                     buf.last_error or "(none)")

            segments = buf.segments_for_window(cam.buffer_seconds)
            log.info("[%s] segmentos obtidos: %d arquivos", cam.name, len(segments))
            for s in segments[:5]:
                log.info("[%s]   segmento: %s (exists=%s size=%s)",
                         cam.name, s, s.exists(), s.stat().st_size if s.exists() else 0)
            if len(segments) > 5:
                log.info("[%s]   ... e mais %d segmentos", cam.name, len(segments) - 5)

            log.info("[%s] chamando build_clip() ...", cam.name)
            clip_path, duration = build_clip(self.settings, cam, segments)
            log.info("[%s] build_clip() OK — path=%s duration=%.2fs", cam.name, clip_path, duration)
        except ClipBuildError:
            log.exception("[%s] FALHA no build_clip (ClipBuildError)", cam.name)
            return
        except Exception:
            log.exception("[%s] FALHA no build_clip (erro inesperado)", cam.name)
            return

        clip_path_ref = clip_path
        log.info("[%s] upload_clip() iniciado ...", cam.name)
        try:
            r2_key, video_url, size = upload_clip(
                self.settings,
                camera_id=cam.id,
                replay_id=replay_id,
                file_path=clip_path_ref,
            )
            log.info("[%s] upload_clip() OK — r2_key=%s video_url=%s size=%d",
                     cam.name, r2_key, video_url, size)
        except Exception:
            log.exception("[%s] FALHA no upload_clip()", cam.name)
            clip_path_ref.unlink(missing_ok=True)
            return

        log.info("[%s] register_replay() iniciado ...", cam.name)
        try:
            api_client.register_replay(
                self.settings,
                quadra_id=cam.quadra_id,
                r2_key=r2_key,
                video_url=video_url,
                duration_sec=duration,
                file_size_bytes=size,
            )
            log.info("[%s] register_replay() OK — replay registrado no banco", cam.name)
        except Exception:
            log.exception("[%s] FALHA no register_replay()", cam.name)

        clip_path_ref.unlink(missing_ok=True)
        log.info("[%s] FINALIZADO — replay %s concluido", cam.name, replay_id)
        log.info("=" * 60)

    # -- sponsor cache sync ------------------------------------------------

    def _sync_sponsors(self) -> None:
        """Download das imagens dos patrocinadores para /opt/looplance-edge/sponsors/<arena_id>/.
        Remove imagens órfãs se a lista de patrocinadores mudar.
        Usa a arena_id da primeira câmera (todas compartilham a mesma arena no device).
        Cria o diretório automaticamente no SSD se for uma arena nova.
        """
        if not self.settings.sponsors:
            return
        arena_id = None
        for cam in self.settings.cameras:
            if cam.arena_id and cam.arena_id != "unknown-arena":
                arena_id = cam.arena_id
                break
        if not arena_id:
            return

        arena_path = SPONSOR_DIR / arena_id
        if not arena_path.exists():
            arena_path.mkdir(parents=True, exist_ok=True)
            os.chmod(arena_path, 0o755)
            log.info(
                "Nova arena detectada de forma síncrona. "
                "Diretório criado automaticamente no SSD: %s",
                arena_path,
            )

        arena_dir = SPONSOR_CACHE_DIR / arena_id

        wanted = set()
        for s in self.settings.sponsors:
            pos = s.get("position_index")
            url = s.get("logo_url")
            if not pos or not url:
                continue
            wanted.add(pos)
            dest = arena_dir / f"slot_{pos}.png"
            if dest.is_file():
                continue
            try:
                resp = httpx.get(url, timeout=15)
                resp.raise_for_status()
                dest.write_bytes(resp.content)
                log.info("[sponsor] cache salvo: %s -> %s", url, dest)
            except Exception:
                log.exception("[sponsor] falha ao baixar %s", url)

        # Relatório de validação física de cada arquivo no SSD
        for pos in sorted(wanted):
            path = arena_dir / f"slot_{pos}.png"
            exists = path.is_file()
            size = path.stat().st_size if exists else 0
            log.info(
                "Verificando arquivo no SSD: %s/slot_%s.png -> Existe: %s (Tamanho: %s bytes)",
                arena_dir, pos, exists, size,
            )

        # Remove órfãos (slot_*.png que não estão mais na lista desejada)
        for f in arena_dir.glob("slot_*.png"):
            try:
                stem = int(f.stem.replace("slot_", ""))
            except (ValueError, IndexError):
                f.unlink(missing_ok=True)
                continue
            if stem not in wanted:
                f.unlink(missing_ok=True)
                log.info("[sponsor] removido órfão: %s", f.name)

    # -- background loops --------------------------------------------------

    def _heartbeat_loop(self) -> None:
        local_ip = get_local_ip()
        while not _shutdown.is_set():
            uptime = int(time.time() - START_TIME)
            api_client.send_heartbeat(self.settings, local_ip=local_ip, uptime_seconds=uptime)
            _shutdown.wait(self.settings.heartbeat_interval_seconds)

    def _health_loop(self) -> None:
        while not _shutdown.is_set():
            for cam in self.settings.cameras:
                buf = self.buffers.get(cam.id)
                if not buf:
                    continue
                if not buf.is_alive():
                    log.warning("[%s] ffmpeg caiu, reiniciando segmentador", cam.name)
                    api_client.report_camera_status(
                        self.settings, camera_id=cam.id, streaming_status="offline",
                        streaming_error=buf.last_error,
                    )
                    buf.stop()
                    buf.start()
                else:
                    api_client.report_camera_status(
                        self.settings, camera_id=cam.id, streaming_status="online",
                    )

                # Watchdog do live HLS
                live = self.livers.get(cam.id)
                if live and not live.is_alive():
                    log.warning("[%s] live HLS caiu, reiniciando", cam.name)
                    try:
                        live.stop()
                        live.start()
                    except Exception:  # noqa: BLE001
                        log.exception("[%s] falha ao reiniciar live HLS", cam.name)
            _shutdown.wait(15)

    def _manual_trigger_loop(self) -> None:
        """Polling curto para disparos manuais via painel (sem botoeira física)."""
        while not _shutdown.is_set():
            try:
                triggers = api_client.fetch_pending_triggers(self.settings)
                if not triggers:
                    log.info("Nenhum replay pendente.")
                else:
                    for t in triggers:
                        cam_id = t.get("camera_id")
                        trigger_id = t.get("id", "?")
                        arena_id = t.get("arena_id", "?")
                        replay_sec = t.get("replay_seconds", "?")
                        if cam_id:
                            log.info(
                                "Replay encontrado. Trigger ID=%s | Camera: %s | Arena: %s | "
                                "Replay Seconds: %s | Iniciando processamento...",
                                trigger_id, cam_id, arena_id, replay_sec,
                            )
                            self._trigger_by_camera_id(cam_id)
                        else:
                            log.warning(
                                "Trigger ID=%s sem camera_id — ignorado. Conteudo: %s",
                                trigger_id, t,
                            )
            except Exception:  # noqa: BLE001
                log.exception("erro no _manual_trigger_loop")
            _shutdown.wait(3)

    def _config_refresh_loop(self) -> None:
        """Recarrega config remota periodicamente e sincroniza buffers.
        Detecta mudancas de protocolo/URL/cadastro no frontend e reinicia
        os processos do FFmpeg dinamicamente sem derrubar o servico.
        """
        while not _shutdown.is_set():
            _shutdown.wait(30)
            try:
                cfg.fetch_remote_config(self.settings)
                self._sync_buffers()
                self._sync_sponsors()
            except Exception:  # noqa: BLE001
                log.exception("erro no _config_refresh_loop")



def _cleanup_tmp_dir(settings: cfg.Settings) -> None:
    tmp_dir = settings.ram_buffer_dir / "tmp"
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir, ignore_errors=True)
        log.info("limpeza de %s concluída", tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)


def main() -> None:
    settings = cfg.load_settings()
    cfg.fetch_remote_config(settings)

    _cleanup_tmp_dir(settings)

    agent = EdgeAgent(settings)

    def handle_signal(signum, frame):  # noqa: ANN001
        log.info("recebido sinal %s, encerrando...", signum)
        _shutdown.set()
        agent.stop()
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    agent.start()
    log.info("looplance-edge no ar. device_id=%s", settings.edge_device_id)

    monitor_script = Path("/opt/looplance-edge/monitor.sh")
    if monitor_script.is_file() and os.access(monitor_script, os.X_OK):
        log.info("Central de Comando disponivel: looplance-monitor")
    else:
        log.warning("monitor.sh ausente ou sem permissao de execucao — rode sudo ./install.sh")
    while not _shutdown.is_set():
        time.sleep(1)


if __name__ == "__main__":
    main()
