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

import logging
import signal
import socket
import sys
import threading
import time
import uuid

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

        start_trigger_listener(self._on_trigger, self._input_boards())

        threading.Thread(target=self._heartbeat_loop, daemon=True).start()
        threading.Thread(target=self._health_loop, daemon=True).start()

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

        try:
            # arena_id não é conhecido localmente (o backend resolve via quadra_id
            # no INSERT), mas para a key do R2 usamos o arena_id vindo da config
            # remota, se disponível; senão o backend recalcula/realoca se preciso.
            arena_id = getattr(cam, "arena_id", None) or "unknown-arena"
            r2_key, video_url, size = upload_clip(
                self.settings,
                arena_id=arena_id,
                quadra_id=cam.quadra_id,
                replay_id=replay_id,
                file_path=clip_path,
            )
            api_client.register_replay(
                self.settings,
                quadra_id=cam.quadra_id,
                r2_key=r2_key,
                video_url=video_url,
                duration_sec=duration,
                file_size_bytes=size,
            )
            log.info("[%s] replay %s publicado: %s", cam.name, replay_id, video_url)
        except Exception:  # noqa: BLE001
            log.exception("[%s] falha ao publicar replay", cam.name)
        finally:
            clip_path.unlink(missing_ok=True)

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



def main() -> None:
    settings = cfg.load_settings()
    cfg.fetch_remote_config(settings)

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
