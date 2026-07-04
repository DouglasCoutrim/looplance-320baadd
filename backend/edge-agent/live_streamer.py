"""
Streaming HLS ao vivo por câmera.

Estratégia:
  * ffmpeg lê o RTSP e escreve HLS (index.m3u8 + fragmentos .ts) em tmpfs.
  * Usamos `-hls_flags delete_segments+append_list+omit_endlist+program_date_time`
    para manter uma janela deslizante curta e o próprio ffmpeg apaga os
    fragmentos antigos localmente.
  * Uma thread watcher observa a pasta e:
      - faz upload dos fragmentos novos (.ts) para o bucket `looplance-live`
        em `live/{arena_id}/{quadra_id}/<filename>` (Content-Type ts, cache 6s).
      - reescreve `index.m3u8` no R2 a cada mudança (Content-Type m3u8,
        cache 1s, no-store).
      - deleta do R2 os fragmentos que o ffmpeg removeu localmente, evitando
        acúmulo (não pagamos armazenamento de VOD por engano).

Sem HD: tudo em /dev/shm/looplance/live/<camera_id>/.
"""
from __future__ import annotations

import logging
import subprocess
import threading
import time
from pathlib import Path

import boto3
from botocore.config import Config

from config import CameraConfig, Settings

log = logging.getLogger("looplance.live")

M3U8_NAME = "index.m3u8"


def _r2_client(settings: Settings):
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 3},
            s3={"addressing_style": "path"},
        ),
        region_name="auto",
    )


class LiveStreamer:
    """Roda um ffmpeg HLS por câmera e espelha a pasta em R2 (bucket live)."""

    def __init__(self, settings: Settings, camera: CameraConfig):
        self.settings = settings
        self.camera = camera
        self.arena_id = camera.arena_id or "unknown-arena"
        self.dir = settings.ram_buffer_dir / "live" / camera.id
        self.key_prefix = f"live/{self.arena_id}/{camera.quadra_id}"
        self.bucket = settings.r2_live_bucket_name

        self._proc: subprocess.Popen | None = None
        self._watch_thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._uploaded: set[str] = set()  # nomes de .ts já enviados
        self._last_playlist_mtime: float = 0.0
        self._client = _r2_client(settings)
        self.last_error: str | None = None

    # -- lifecycle ------------------------------------------------------

    def start(self) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        for f in list(self.dir.glob("*.ts")) + list(self.dir.glob("*.m3u8")):
            f.unlink(missing_ok=True)
        # limpa bucket residual (fragmentos de sessão anterior)
        self._purge_remote()

        playlist = self.dir / M3U8_NAME
        segment_pattern = str(self.dir / "seg_%05d.ts")

        cmd = [
            "ffmpeg",
            "-nostdin",
            "-rtsp_transport", "tcp",
            "-i", self.camera.rtsp_url,
            "-c", "copy",
            "-f", "hls",
            "-hls_time", str(self.settings.hls_segment_seconds),
            "-hls_list_size", str(self.settings.hls_list_size),
            "-hls_flags", "delete_segments+append_list+omit_endlist+program_date_time",
            "-hls_segment_type", "mpegts",
            "-hls_segment_filename", segment_pattern,
            "-hls_allow_cache", "0",
            str(playlist),
        ]
        log.info("[%s] iniciando live HLS: %s", self.camera.name, " ".join(cmd))
        self._proc = subprocess.Popen(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True
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
        # limpa o bucket para não deixar playlist "fantasma" tocando
        try:
            self._purge_remote()
        except Exception:  # noqa: BLE001
            log.exception("[%s] falha ao limpar bucket live no stop", self.camera.name)

    def is_alive(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    # -- watcher / uploader ---------------------------------------------

    def _watch_loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._sync_once()
            except Exception as e:  # noqa: BLE001
                self.last_error = str(e)
                log.exception("[%s] erro no sync HLS", self.camera.name)
            self._stop.wait(0.5)

        if self._proc and self._proc.stderr:
            tail = self._proc.stderr.read()
            if tail:
                self.last_error = tail[-500:]

    def _sync_once(self) -> None:
        # 1) sobe fragmentos .ts novos
        local_ts = {p.name: p for p in self.dir.glob("*.ts")}
        for name, path in sorted(local_ts.items()):
            if name in self._uploaded:
                continue
            self._upload_segment(path)
            self._uploaded.add(name)

        # 2) apaga do R2 fragmentos que o ffmpeg já removeu localmente
        stale = self._uploaded - set(local_ts.keys())
        for name in stale:
            self._delete_remote(f"{self.key_prefix}/{name}")
            self._uploaded.discard(name)

        # 3) reescreve o index.m3u8 no R2 sempre que ele muda localmente
        playlist = self.dir / M3U8_NAME
        if playlist.exists():
            mtime = playlist.stat().st_mtime
            if mtime != self._last_playlist_mtime:
                self._upload_playlist(playlist)
                self._last_playlist_mtime = mtime

    def _upload_segment(self, path: Path) -> None:
        key = f"{self.key_prefix}/{path.name}"
        self._client.upload_file(
            str(path),
            self.bucket,
            key,
            ExtraArgs={
                "ContentType": "video/mp2t",
                "CacheControl": "public, max-age=6",
            },
        )

    def _upload_playlist(self, path: Path) -> None:
        key = f"{self.key_prefix}/{M3U8_NAME}"
        self._client.upload_file(
            str(path),
            self.bucket,
            key,
            ExtraArgs={
                "ContentType": "application/vnd.apple.mpegurl",
                "CacheControl": "no-store, max-age=1",
            },
        )

    def _delete_remote(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self.bucket, Key=key)
        except Exception:  # noqa: BLE001
            log.exception("falha ao deletar %s", key)

    def _purge_remote(self) -> None:
        """Deleta todos os objetos sob o prefix desta câmera."""
        paginator = self._client.get_paginator("list_objects_v2")
        to_delete: list[dict] = []
        for page in paginator.paginate(Bucket=self.bucket, Prefix=f"{self.key_prefix}/"):
            for obj in page.get("Contents", []) or []:
                to_delete.append({"Key": obj["Key"]})
                if len(to_delete) >= 1000:
                    self._client.delete_objects(Bucket=self.bucket, Delete={"Objects": to_delete})
                    to_delete = []
        if to_delete:
            self._client.delete_objects(Bucket=self.bucket, Delete={"Objects": to_delete})

    def public_playlist_url(self) -> str:
        return f"{self.settings.r2_live_public_base_url}/{self.key_prefix}/{M3U8_NAME}"
