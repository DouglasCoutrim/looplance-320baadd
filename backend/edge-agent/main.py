"""
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
import signal
import socket
import subprocess
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

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
SPONSOR_CACHE_DIR = Path("/dev/shm/looplance/sponsors")


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
        cam = next((c for c in self.settings.cameras if c.trigger_button == local_key), None)
        if not cam:
            log.warning("botão %s pressionado mas nenhuma câmera configurada com ele", local_key)
            return
        self._executor.submit(self._handle_replay, cam)

    def _trigger_by_camera_id(self, camera_id: str) -> None:
        cam = next((c for c in self.settings.cameras if c.id == camera_id), None)
        if not cam:
            log.info("manual trigger: camera %s desconhecida, recarregando config remota...", camera_id)
            try:
                cfg.fetch_remote_config(self.settings)
                self._sync_buffers()
            except Exception:  # noqa: BLE001
                log.exception("falha ao recarregar config remota")
                return
            cam = next((c for c in self.settings.cameras if c.id == camera_id), None)
        if not cam:
            log.warning("manual trigger: camera %s continua indisponível após refresh", camera_id)
            return
        log.info("manual trigger recebido para camera %s (%s)", cam.name, camera_id)
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
        try:
            buf = self.buffers.get(cam.id)
            if not buf:
                log.error("[%s] sem buffer ativo", cam.name)
                return

            replay_id = str(uuid.uuid4())
            log.info("[%s] gerando replay %s", cam.name, replay_id)

            segments = buf.segments_for_window(cam.buffer_seconds)
            clip_path, duration = build_clip(self.settings, cam, segments)
        except ClipBuildError:
            log.exception("[%s] falha ao montar clip", cam.name)
            return
        except Exception:
            log.exception("[%s] erro inesperado ao montar clip", cam.name)
            return

        clip_path_ref = clip_path
        try:
            r2_key, video_url, size = upload_clip(
                self.settings,
                camera_id=cam.id,
                replay_id=replay_id,
                file_path=clip_path_ref,
            )
        except Exception:
            log.exception("[%s] falha ao enviar clip ao R2", cam.name)
            clip_path_ref.unlink(missing_ok=True)
            return

        log.info("[%s] replay %s enviado ao R2", cam.name, replay_id)

        # INSERT no Supabase imediatamente após upload bem-sucedido
        try:
            api_client.register_replay(
                self.settings,
                quadra_id=cam.quadra_id,
                r2_key=r2_key,
                video_url=video_url,
                duration_sec=duration,
                file_size_bytes=size,
            )
            log.info("[%s] replay %s registrado no banco com status ready", cam.name, replay_id)
        except Exception:
            log.exception("[%s] falha ao registrar replay no banco", cam.name)

        clip_path_ref.unlink(missing_ok=True)

    # -- sponsor cache sync ------------------------------------------------

    def _sync_sponsors(self) -> None:
        """Download das imagens dos patrocinadores para /dev/shm/looplance/sponsors/<arena_id>/.
        Remove imagens órfãs se a lista de patrocinadores mudar.
        Usa a arena_id da primeira câmera (todas compartilham a mesma arena no device).
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

        arena_dir = SPONSOR_CACHE_DIR / arena_id
        arena_dir.mkdir(parents=True, exist_ok=True)

        wanted = set()
        for s in self.settings.sponsors:
            pos = s.get("position_index")
            url = s.get("logo_url")
            if not pos or not url:
                continue
            wanted.add(pos)
            dest = arena_dir / f"{pos}.png"
            if dest.is_file():
                continue
            try:
                resp = httpx.get(url, timeout=15)
                resp.raise_for_status()
                dest.write_bytes(resp.content)
                log.info("[sponsor] cache salvo: %s -> %s", url, dest)
            except Exception:
                log.exception("[sponsor] falha ao baixar %s", url)

        # Remove órfãos
        for f in arena_dir.glob("*.png"):
            stem = int(f.stem)
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
                for t in triggers:
                    cam_id = t.get("camera_id")
                    if cam_id:
                        self._trigger_by_camera_id(cam_id)
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
    while not _shutdown.is_set():
        time.sleep(1)


if __name__ == "__main__":
    main()
