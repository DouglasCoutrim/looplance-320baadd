"""
Streaming RTMP para YouTube Live por câmera.

Estratégia:
  * ffmpeg lê o RTSP/RTMP da câmera e empurra para a ingestão RTMP do YouTube.
  * Usamos `-c copy` para evitar reencode (a câmera já manda H.264/AAC).
  * Thread watcher monitora o processo e reconecta se cair.
"""
from __future__ import annotations

import logging
import subprocess
import threading
import time
from pathlib import Path

from config import CameraConfig, Settings

log = logging.getLogger("looplance.youtube")

YOUTUBE_RTMP_BASE = "rtmp://a.rtmp.youtube.com/live2"


class YouTubeStreamer:
    """Roda um ffmpeg que empurra o stream da câmera para o YouTube Live."""

    def __init__(self, settings: Settings, camera: CameraConfig, stream_key: str):
        self.settings = settings
        self.camera = camera
        self.stream_key = stream_key
        self.youtube_url = f"{YOUTUBE_RTMP_BASE}/{stream_key}"

        self._proc: subprocess.Popen | None = None
        self._watch_thread: threading.Thread | None = None
        self._stop = threading.Event()
        self.last_error: str | None = None

    def start(self) -> None:
        camera = self.camera
        url = getattr(camera, "rtsp_url", None) or getattr(camera, "rtmp_url", None) or ""

        if not url:
            log.warning("[%s] URL de transmissão não encontrada — YouTube Live ignorado", camera.name)
            return

        if camera.stream_protocol == "rtmp":
            if any(host in url for host in ("127.0.0.1", "0.0.0.0", "localhost")):
                input_args = ["-listen", "1", "-i", url]
            else:
                input_args = ["-i", url]
        else:
            input_args = ["-rtsp_transport", "tcp", "-i", url]

        cmd = [
            "ffmpeg",
            "-nostdin",
            "-re",
            *input_args,
            "-c", "copy",
            "-f", "flv",
            "-flvflags", "no_duration_filesize",
            self.youtube_url,
        ]
        log.info("[%s] iniciando YouTube Live: %s", camera.name, " ".join(cmd[:8]) + " ... " + self.youtube_url)

        self._proc = subprocess.Popen(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
        )
        self._stop.clear()
        self._watch_thread = threading.Thread(target=self._watch_loop, daemon=True)
        self._watch_thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()
        if self._watch_thread:
            self._watch_thread.join(timeout=5)
        log.info("[%s] YouTube Live parado", self.camera.name)

    def is_alive(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def _watch_loop(self) -> None:
        while not self._stop.is_set():
            if self._proc and self._proc.poll() is not None:
                returncode = self._proc.returncode
                stderr_tail = ""
                if self._proc.stderr:
                    stderr_tail = self._proc.stderr.read()[-500:]
                self.last_error = stderr_tail or f"ffmpeg encerrou com código {returncode}"
                log.warning(
                    "[%s] YouTube Live caiu (código %d): %s",
                    self.camera.name, returncode, self.last_error[:200],
                )
                return
            self._stop.wait(2)
