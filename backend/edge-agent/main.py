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

import shutil

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

        start_trigger_listener(self._on_trigger, self._input_boards())

        threading.Thread(target=self._heartbeat_loop, daemon=True).start()
        threading.Thread(target=self._health_loop, daemon=True).start()
        threading.Thread(target=self._manual_trigger_loop, daemon=True).start()
        threading.Thread(target=self._config_refresh_loop, daemon=True).start()

    def stop(self) -> None:
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
        mapping = self.settings.button_map.get(local_key)
        if not mapping:
            log.warning("botão %s pressionado mas sem câmera mapeada", local_key)
            return
        cam = next((c for c in self.settings.cameras if c.id == mapping.camera_id), None)
        if not cam:
            log.warning("câmera %s do mapeamento %s não encontrada/ativa", mapping.camera_id, local_key)
            return
        threading.Thread(target=self._handle_replay, args=(cam,), daemon=True).start()

    def _trigger_by_camera_id(self, camera_id: str) -> None:
        cam = next((c for c in self.settings.cameras if c.id == camera_id), None)
        if not cam:
            # Provavelmente a câmera foi criada/editada depois do boot do
            # agente. Recarrega config remota e sobe buffers novos.
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
        threading.Thread(target=self._handle_replay, args=(cam,), daemon=True).start()

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
        buf = self.buffers.get(cam.id)
        if not buf:
            log.error("[%s] sem buffer ativo", cam.name)
            return

        replay_id = str(uuid.uuid4())
        log.info("[%s] gerando replay %s", cam.name, replay_id)
        try:
            segments = buf.segments_for_window(cam.buffer_seconds)
            clip_path, duration = build_clip(self.settings, cam, segments)
        except ClipBuildError:
            log.exception("[%s] falha ao montar clip", cam.name)
            return

        # Registra o replay como 'processing' antes do upload para que,
        # mesmo que o upload ou a atualização de status falhem, o registro
        # exista no banco e possa ser recuperado posteriormente.
        draft = None
        try:
            draft = api_client.register_replay_draft(
                self.settings,
                quadra_id=cam.quadra_id,
            )
        except Exception:  # noqa: BLE001
            log.exception("[%s] falha ao registrar draft do replay", cam.name)

        r2_key = video_url = ""
        size = 0
        upload_ok = False
        try:
            r2_key, video_url, size = upload_clip(
                self.settings,
                arena_id=cam.arena_id,
                quadra_id=cam.quadra_id,
                replay_id=replay_id,
                file_path=clip_path,
            )
            upload_ok = True
            log.info("[%s] replay %s enviado ao R2", cam.name, replay_id)
        except Exception:  # noqa: BLE001
            log.exception("[%s] falha ao enviar clip ao R2", cam.name)

        # Atualiza o draft com o status final
        if draft:
            draft_id = draft.get("replay", {}).get("id", "")
            if draft_id and upload_ok:
                try:
                    api_client.update_replay_status(
                        self.settings,
                        replay_id=draft_id,
                        status="ready",
                        r2_key=r2_key,
                        video_url=video_url,
                        duration_sec=duration,
                        file_size_bytes=size,
                    )
                    log.info("[%s] replay %s publicado com sucesso", cam.name, replay_id)
                except Exception:  # noqa: BLE001
                    log.exception("[%s] falha ao atualizar status do replay", cam.name)
            elif draft_id:
                try:
                    api_client.update_replay_status(
                        self.settings,
                        replay_id=draft_id,
                        status="failed",
                    )
                except Exception:  # noqa: BLE001
                    log.exception("[%s] falha ao marcar replay como failed", cam.name)

        # Cleanup: remove o MP4 temporário da RAM
        try:
            clip_path.unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass

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
