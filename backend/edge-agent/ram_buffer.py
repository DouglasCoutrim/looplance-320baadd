"""
Buffer circular EM RAM por câmera.

Estratégia: nenhum frame é gravado em HD. O ffmpeg grava segmentos curtos
(SEGMENT_SECONDS) direto em tmpfs (RAM_BUFFER_DIR, que deve estar montado
como tmpfs -- normalmente /dev/shm já é). Usamos `-segment_wrap` para que
o próprio ffmpeg recicle os nomes de arquivo automaticamente assim que o
buffer atinge `buffer_seconds`, sem nunca escrever no disco e sem exigir
limpeza manual de arquivos antigos.

Cada CameraBuffer roda seu próprio processo ffmpeg + uma thread leve que
observa a pasta de segmentos para manter, em memória de processo, a lista
ordenada de (arquivo, timestamp_criação) usada para montar o replay quando
o botão é pressionado.
"""
from __future__ import annotations

import logging
import math
import subprocess
import threading
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from config import CameraConfig, Settings

log = logging.getLogger("looplance.buffer")


@dataclass
class Segment:
    path: Path
    created_at: float  # epoch seconds


class CameraBuffer:
    """Gerencia o ffmpeg de segmentação e a lista de segmentos em RAM de uma câmera."""

    def __init__(self, settings: Settings, camera: CameraConfig):
        self.settings = settings
        self.camera = camera
        self.dir = settings.ram_buffer_dir / camera.id
        self.segment_seconds = settings.segment_seconds
        self.wrap_count = max(4, math.ceil(camera.buffer_seconds / self.segment_seconds) + 2)

        self._proc: subprocess.Popen | None = None
        self._watch_thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._segments: deque[Segment] = deque(maxlen=self.wrap_count)
        self._known_files: set[str] = set()
        self.last_status = "starting"
        self.last_error: str | None = None

    # -- lifecycle -----------------------------------------------------

    def _input_args(self) -> list[str]:
        camera = self.camera
        url = (
            getattr(camera, "rtsp_url", None)
            or getattr(camera, "rtmp_url", None)
            or ""
        )

        if not url:
            log.warning(
                "[%s] URL de transmissão não encontrada — câmera será ignorada",
                camera.name,
            )
            return []

        if camera.stream_protocol == "rtmp":
            if any(host in url for host in ("127.0.0.1", "0.0.0.0", "localhost")):
                return ["-listen", "1", "-i", url]
            return ["-i", url]

        return ["-rtsp_transport", "tcp", "-i", url]

    def start(self) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        for f in self.dir.glob("seg_*.ts"):
            f.unlink(missing_ok=True)

        input_args = self._input_args()
        if not input_args:
            self.last_status = "offline"
            self.last_error = "URL de transmissão não configurada"
            return

        pattern = str(self.dir / "seg_%05d.ts")
        cmd = [
            "ffmpeg",
            "-nostdin",
            *input_args,
            "-c", "copy",
            "-f", "segment",
            "-segment_time", str(self.segment_seconds),
            "-segment_wrap", str(self.wrap_count),
            "-segment_format", "mpegts",
            "-reset_timestamps", "1",
            pattern,
        ]
        log.info("[%s] iniciando segmentador RAM: %s", self.camera.name, " ".join(cmd))
        self._proc = subprocess.Popen(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True
        )
        self._stop.clear()
        self._watch_thread = threading.Thread(target=self._watch_loop, daemon=True)
        self._watch_thread.start()
        self.last_status = "online"

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

    def is_alive(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    # -- internals -------------------------------------------------------

    def _watch_loop(self) -> None:
        """Observa a pasta e mantém a lista ordenada de segmentos recentes."""
        while not self._stop.is_set():
            try:
                for f in sorted(self.dir.glob("seg_*.ts")):
                    key = f.name
                    if key in self._known_files:
                        continue
                    # pequeno delay para garantir que o ffmpeg terminou de escrever
                    self._known_files.add(key)
                    with self._lock:
                        self._segments.append(Segment(path=f, created_at=time.time()))
                        if len(self._segments) == self.wrap_count:
                            # limpa referências de arquivos que o ffmpeg já reciclou
                            valid = {s.path.name for s in self._segments}
                            self._known_files &= valid
                self.last_status = "online" if self.is_alive() else "offline"
            except Exception as e:  # noqa: BLE001
                log.exception("[%s] erro observando buffer", self.camera.name)
                self.last_error = str(e)
            time.sleep(0.5)

        # captura eventual erro do ffmpeg ao sair
        if self._proc and self._proc.stderr:
            tail = self._proc.stderr.read()
            if tail:
                self.last_error = tail[-500:]

    def segments_for_window(self, seconds: int) -> list[Path]:
        """Retorna os segmentos (em ordem) que cobrem os últimos `seconds`."""
        cutoff = time.time() - seconds - self.segment_seconds  # folga de 1 segmento
        with self._lock:
            chosen = [s.path for s in self._segments if s.created_at >= cutoff]
        return chosen
