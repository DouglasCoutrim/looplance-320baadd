"""
Streaming RTMP para YouTube Live por câmera.

ffmpeg lê o RTSP/RTMP da câmera e empurra para a ingestão RTMP do YouTube
com:
  - `-c:v copy` — copia o H.264 nativo sem reencodar (zero carga de CPU)
  - `-c:a aac -b:a 128k` — converte áudio para AAC (exigência do YouTube)
  - `-f flv` — formato esperado pela ingestão RTMP do YouTube

Roda em thread separada (subprocess.Popen + daemon thread) sem bloquear
o loop principal de captura de botões físicos e buffer de replay em RAM.
"""
from __future__ import annotations

import logging
import os
import signal
import subprocess
import threading
import time
from pathlib import Path

from config import CameraConfig, Settings

log = logging.getLogger("looplance.youtube")

YOUTUBE_RTMP_BASE = "rtmp://a.rtmp.youtube.com/live2"
YOUTUBE_INGEST = "rtmp://a.rtmp.youtube.com/live2"


class YouTubeStreamer:
    """Gerencia o processo ffmpeg que empurra o stream da câmera para o YouTube Live.

    Ciclo de vida:
      start()  → dispara ffmpeg em subprocess + watch thread
      stop()   → SIGTERM → wait(5) → SIGKILL, join na thread
      is_alive() → True enquanto o ffmpeg estiver rodando
    """

    def __init__(self, settings: Settings, camera: CameraConfig, stream_key: str):
        self.settings = settings
        self.camera = camera
        self.stream_key = stream_key
        self.youtube_url = f"{YOUTUBE_INGEST}/{stream_key}"

        self._proc: subprocess.Popen | None = None
        self._watch_thread: threading.Thread | None = None
        self._stop = threading.Event()
        self.last_error: str | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Inicia o ffmpeg em background. Non-blocking."""
        camera = self.camera
        url = getattr(camera, "rtsp_url", None) or getattr(camera, "rtmp_url", None) or ""

        if not url:
            log.warning("[%s] URL de transmissão não encontrada — YouTube Live ignorado", camera.name)
            return

        input_args = self._build_input_args(camera, url)
        if not input_args:
            return

        cmd = [
            "ffmpeg",
            "-nostdin",
            "-re",
            *input_args,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-ac", "2",
            "-f", "flv",
            "-flvflags", "no_duration_filesize",
            self.youtube_url,
        ]
        log.info(
            "[%s] YouTube Live: %s",
            camera.name,
            " ".join(str(a) for a in cmd[:8]) + " ... " + self.youtube_url,
        )

        self._proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
        self._stop.clear()
        self._watch_thread = threading.Thread(target=self._watch_loop, daemon=True)
        self._watch_thread.start()

    def stop(self) -> None:
        """Interrompe o ffmpeg com sinal SIGTERM. Se não responder em 5s, SIGKILL."""
        self._stop.set()
        if self._proc and self._proc.poll() is None:
            pid = self._proc.pid
            log.info("[%s] enviando SIGTERM para ffmpeg pid=%d", self.camera.name, pid)
            try:
                os.kill(pid, signal.SIGTERM)
                self._proc.wait(timeout=5)
            except ProcessLookupError:
                pass
            except subprocess.TimeoutExpired:
                log.warning(
                    "[%s] ffmpeg não respondeu ao SIGTERM — enviando SIGKILL pid=%d",
                    self.camera.name, pid,
                )
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                self._proc.wait(timeout=2)
        # Consome stderr restante para evitar pipe deadlock
        if self._proc and self._proc.stderr:
            try:
                tail = self._proc.stderr.read()
                if tail:
                    log.debug("[%s] stderr final: %s", self.camera.name, tail[-300:])
            except Exception:
                pass
        if self._watch_thread:
            self._watch_thread.join(timeout=5)
        log.info("[%s] YouTube Live parado", self.camera.name)

    def is_alive(self) -> bool:
        """Retorna True se o processo ffmpeg ainda está rodando."""
        return self._proc is not None and self._proc.poll() is None

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _build_input_args(camera: CameraConfig, url: str) -> list[str]:
        if camera.stream_protocol == "rtmp":
            if any(host in url for host in ("127.0.0.1", "0.0.0.0", "localhost")):
                return ["-listen", "1", "-i", url]
            return ["-i", url]
        return ["-rtsp_transport", "tcp", "-i", url]

    def _watch_loop(self) -> None:
        """Monitora o ffmpeg. Encerra quando o processo morre ou o stop é acionado."""
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
