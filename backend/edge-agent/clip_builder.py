"""
Monta o replay final a partir dos segmentos em RAM:
  1. concatena os segmentos relevantes (concat demuxer)
  2. corta para exatamente `replay_seconds` (a partir do fim)
  3. queima o overlay (sponsor/marca) se configurado
  4. grava o mp4 final também em tmpfs (nunca em HD)

O caller é responsável por apagar o mp4 final depois do upload.
"""
from __future__ import annotations

import logging
import subprocess
import time
import uuid
from pathlib import Path

from config import CameraConfig, Settings

log = logging.getLogger("looplance.clip")


class ClipBuildError(RuntimeError):
    pass


def build_clip(settings: Settings, camera: CameraConfig, segments: list[Path]) -> tuple[Path, float]:
    if not segments:
        raise ClipBuildError("nenhum segmento disponível no buffer ainda")

    tmp_dir = settings.ram_buffer_dir / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    clip_id = uuid.uuid4().hex
    concat_list = tmp_dir / f"{clip_id}_list.txt"
    concat_list.write_text("".join(f"file '{s.resolve()}'\n" for s in segments))

    output_path = tmp_dir / f"{clip_id}.mp4"

    overlay_url = camera.final_overlay_url or camera.overlay_url
    replay_seconds = camera.replay_seconds

    filter_complex = None
    # -sseof é INPUT option: precisa vir ANTES do -i correspondente.
    # Aplica só ao concat (primeiro input), pega os últimos N segundos.
    inputs = [
        "-sseof", f"-{replay_seconds}",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
    ]

    if overlay_url:
        inputs += ["-i", overlay_url]
        ov_w = camera.video_width or "iw"
        ov_h = camera.video_height or "ih"
        ov_x = camera.video_x or 0
        ov_y = camera.video_y or 0
        filter_complex = f"[1:v]scale={ov_w}:{ov_h}[ov];[0:v][ov]overlay={ov_x}:{ov_y}"

    cmd = ["ffmpeg", "-y", "-nostdin", *inputs]

    if filter_complex:
        cmd += ["-filter_complex", filter_complex, "-map", "0:a?"]
    cmd += [
        "-t", str(replay_seconds),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac",
        "-movflags", "+faststart",
        str(output_path),
    ]

    log.info("[%s] montando clip: %s", camera.name, " ".join(cmd))
    t0 = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not output_path.exists():
        concat_list.unlink(missing_ok=True)
        raise ClipBuildError(f"ffmpeg falhou ({proc.returncode}): {proc.stderr[-1000:]}")

    duration = time.time() - t0
    concat_list.unlink(missing_ok=True)

    real_duration = _probe_duration(output_path) or float(replay_seconds)
    return output_path, real_duration


def _probe_duration(path: Path) -> float | None:
    try:
        proc = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(path),
            ],
            capture_output=True, text=True, timeout=10,
        )
        return float(proc.stdout.strip())
    except Exception:  # noqa: BLE001
        return None
