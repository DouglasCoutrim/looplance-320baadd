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

SPONSOR_CACHE_DIR = Path("/dev/shm/looplance/sponsors")


def _cached_sponsor_paths(settings: Settings, arena_id: str) -> list[dict]:
    """Retorna lista de dicts com input_idx, position_index e path do arquivo
    para cada patrocinador ativo que tem imagem em cache.
    Usa input_idx sequencial (2, 3, 4...) porque input 0 = lavfi, input 1 = vídeo.
    """
    result: list[dict] = []
    arena_dir = SPONSOR_CACHE_DIR / arena_id
    if not arena_dir.is_dir():
        return result
    for s in settings.sponsors:
        pos = s.get("position_index")
        if not pos:
            continue
        cached = arena_dir / f"{pos}.png"
        if cached.is_file():
            result.append({
                "input_idx": len(result) + 2,
                "position_index": pos,
                "path": str(cached),
            })
    return result

log = logging.getLogger("looplance.clip")


class ClipBuildError(RuntimeError):
    pass


def build_clip(settings: Settings, camera: CameraConfig, segments: list[Path]) -> tuple[Path, float]:
    if not segments:
        raise ClipBuildError("nenhum segmento disponível no buffer ainda")

    # Filtra segmentos que ainda existem (o FFmpeg pode ter reciclado algum
    # entre a listagem e a montagem do clipe)
    valid_segments = [s for s in segments if s.exists()]
    if len(valid_segments) < 2:
        log.warning(
            "[%s] apenas %d segmento(s) disponíveis (de %d) — insuficiente para montar clipe",
            camera.name, len(valid_segments), len(segments),
        )
        raise ClipBuildError("segmentos insuficientes ou reciclados durante a montagem")

    if len(valid_segments) != len(segments):
        log.warning(
            "[%s] %d segmento(s) reciclado(s) durante a montagem, continuando com %d",
            camera.name, len(segments) - len(valid_segments), len(valid_segments),
        )

    tmp_dir = settings.ram_buffer_dir / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    clip_id = uuid.uuid4().hex
    concat_list = tmp_dir / f"{clip_id}_list.txt"
    concat_list.write_text("".join(f"file '{s.resolve()}'\n" for s in valid_segments))

    output_path = tmp_dir / f"{clip_id}.mp4"

    replay_seconds = camera.replay_seconds
    vertical = camera.aspect_ratio == "9:16"

    inputs = [
        "-sseof", f"-{replay_seconds}",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
    ]

    filter_complex = None

    if vertical:
        sponsor_paths = _cached_sponsor_paths(settings, camera.arena_id)
        n_sp = len(sponsor_paths)
        log.info("[%s] modo 9:16 vertical — %d patrocinador(es) em cache", camera.name, n_sp)

        # Input 0: canvas preto | Input 1: vídeo original | Input 2+: patrocinadores
        inputs = [
            "-f", "lavfi", "-i", "color=c=black:s=1080x1920:r=30",
            *inputs,
        ]
        for sp in sponsor_paths:
            inputs += ["-i", str(sp["path"])]

        parts = []
        parts.append("[1:v]scale=1080:1440[vid_scaled]")
        parts.append("[0:v][vid_scaled]overlay=0:240[canvas]")

        label = "[canvas]"
        for sp in sponsor_paths:
            pos = sp["position_index"]
            idx = sp["input_idx"]
            parts.append(f"[{idx}:v]scale=-1:140[sp{idx}]")

            if n_sp == 1:
                x_expr = "(1080-iw)/2"
            else:
                slot_order = (pos - 1) // 2 if pos % 2 == 1 else (pos // 2 - 1)
                x_expr = str(slot_order * 300 + 20)

            y_val = 40 if pos % 2 == 1 else 1730
            parts.append(f"{label}[sp{idx}]overlay={x_expr}:{y_val}[ov{idx}]")
            label = f"[ov{idx}]"

        filter_complex = ";".join(parts)
        last_label = label
    else:
        overlay_url = camera.final_overlay_url or camera.overlay_url
        if overlay_url:
            inputs += ["-i", overlay_url]
            ov_w = camera.video_width or "iw"
            ov_h = camera.video_height or "ih"
            ov_x = camera.video_x or 0
            ov_y = camera.video_y or 0
            filter_complex = f"[1:v]scale={ov_w}:{ov_h}[ov];[0:v][ov]overlay={ov_x}:{ov_y}"

    cmd = ["ffmpeg", "-y", "-nostdin", *inputs]

    if filter_complex:
        if vertical:
            cmd += ["-filter_complex", filter_complex, "-map", last_label, "-map", "1:a?"]
        else:
            cmd += ["-filter_complex", filter_complex, "-map", "0:a?"]
    else:
        cmd += ["-map", "0:v?", "-map", "0:a?"]

    cmd += [
        "-t", str(replay_seconds),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac",
        "-movflags", "+faststart",
        str(output_path),
    ]

    log.info("[%s] montando clip: %s", camera.name, " ".join(cmd))
    t0 = time.time()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
    except subprocess.TimeoutExpired:
        concat_list.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
        raise ClipBuildError("ffmpeg timed out after 45s")
    if proc.returncode != 0 or not output_path.exists():
        concat_list.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
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
