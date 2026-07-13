"""
© 2026 Looplance. All Rights Reserved.
Developed & Patented by Douglas Coutrim Silva.

Monta o replay final a partir dos segmentos em RAM:
   1. concatena os segmentos relevantes (concat demuxer)
   2. corta para exatamente `replay_seconds` (a partir do fim)
   3. queima o overlay (sponsor/marca) se configurado, apenas se
      os arquivos `slot_*.png` existirem fisicamente no SSD
   4. grava o mp4 final tambem em tmpfs

O caller eh responsavel por apagar o mp4 final depois do upload.
"""
from __future__ import annotations

import logging
import subprocess
import time
import uuid
from pathlib import Path

from config import CameraConfig, Settings

SPONSOR_DIR = Path("/opt/looplance-edge/sponsors")

log = logging.getLogger("looplance.clip")


class ClipBuildError(RuntimeError):
    pass


def _validate_sponsor_files(arena_id: str) -> list[dict]:
    """Checagem de integridade: varre o SSD em busca de slot_{i}.png.

    Retorna lista ordenada de dicts {input_idx, position_index, path}
    apenas para arquivos que EXISTEM fisicamente em disco.
    Retorna lista vazia se o diretorio nao existir ou nao houver arquivos.
    """
    arena_dir = SPONSOR_DIR / arena_id
    if not arena_dir.is_dir():
        log.info("[sponsor] diretorio %s nao existe — sem patrocinadores", arena_dir)
        return []

    found = sorted(arena_dir.glob("slot_*.png"))
    if not found:
        log.info("[sponsor] nenhum slot_*.png encontrado em %s", arena_dir)
        return []

    result: list[dict] = []
    for i, f in enumerate(found):
        try:
            pos = int(f.stem.replace("slot_", ""))
        except (ValueError, IndexError):
            log.warning("[sponsor] nome invalido ignorado: %s", f.name)
            continue
        result.append({
            "input_idx": i + 2,
            "position_index": pos,
            "path": str(f.resolve()),
        })
    return result


def build_clip(settings: Settings, camera: CameraConfig, segments: list[Path]) -> tuple[Path, float]:
    if not segments:
        raise ClipBuildError("nenhum segmento disponivel no buffer ainda")

    valid_segments = [s for s in segments if s.exists()]
    if len(valid_segments) < 2:
        log.warning(
            "[%s] apenas %d segmento(s) disponiveis (de %d) — insuficiente para montar clipe",
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
    arena_id = camera.arena_id
    vertical = camera.aspect_ratio == "9:16"

    log.info("Iniciando renderizacao de arena: %s | camera: %s", arena_id, camera.name)

    # ── Checagem de integridade ──────────────────────────────────────
    sponsor_files = _validate_sponsor_files(arena_id) if vertical else []
    n_sp = len(sponsor_files)
    if vertical:
        for sf in sponsor_files:
            p = Path(sf["path"])
            size = p.stat().st_size if p.is_file() else 0
            log.info(
                "[sponsor] arena=%s file=%s size=%d bytes exists=%s input_idx=%d pos=%d",
                arena_id, p.name, size, p.is_file(), sf["input_idx"], sf["position_index"],
            )

    # ── Montagem dinamica dos inputs ─────────────────────────────────
    if vertical:
        # Input 0: canvas preto | Input 1: video | Input 2+: patrocinadores
        inputs = [
            "-f", "lavfi", "-i", "color=c=black:s=1080x1920:r=30:d=30",
            "-sseof", f"-{replay_seconds}",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_list),
        ]
        for sf in sponsor_files:
            inputs += ["-i", sf["path"]]
    else:
        # Input 0: video | Input 1+: overlay se configurado
        inputs = [
            "-sseof", f"-{replay_seconds}",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_list),
        ]

    # ── Filtro complexo dinâmico ─────────────────────────────────────
    filter_complex = None
    last_label = None

    if vertical:
        parts = [
            "[1:v]scale=1080:1440[vid_scaled]",
            "[0:v][vid_scaled]overlay=0:240[bg_with_video]",
        ]
        prev = "[bg_with_video]"

        for i, sf in enumerate(sponsor_files):
            pos = sf["position_index"]
            idx = sf["input_idx"]
            parts.append(f"[{idx}:v]scale=-1:140[sp{idx}]")

            if n_sp == 1:
                x_expr = "(1080-iw)/2"
            else:
                slot_order = (pos - 1) // 2 if pos % 2 == 1 else (pos // 2) - 1
                x_expr = str(slot_order * 300 + 20)

            y_val = 50 if pos % 2 == 1 else 1700
            out_label = "[v_final]" if i == n_sp - 1 else f"[v_tmp{i}]"
            parts.append(f"{prev}[sp{idx}]overlay={x_expr}:{y_val}{out_label}")
            prev = out_label

        filter_complex = ";".join(parts)
        last_label = "[v_final]" if n_sp > 0 else "[bg_with_video]"
    else:
        overlay_url = camera.final_overlay_url or camera.overlay_url
        if overlay_url:
            inputs += ["-i", overlay_url]
            ov_w = camera.video_width or "iw"
            ov_h = camera.video_height or "ih"
            ov_x = camera.video_x or 0
            ov_y = camera.video_y or 0
            filter_complex = f"[1:v]scale={ov_w}:{ov_h}[ov];[0:v][ov]overlay={ov_x}:{ov_y}[v_out]"

    # ── Montagem do comando final ────────────────────────────────────
    cmd = ["ffmpeg", "-y", "-nostdin", *inputs]

    if filter_complex:
        if vertical:
            cmd += [
                "-filter_complex", filter_complex,
                "-map", last_label,
                "-map", "1:a?",
            ]
        else:
            cmd += [
                "-filter_complex", filter_complex,
                "-map", "[v_out]",
                "-map", "0:a?",
            ]
    else:
        cmd += ["-map", "0:v?", "-map", "0:a?"]

    cmd += [
        "-metadata", "title=Looplance Replay",
        "-metadata", "artist=Douglas Coutrim Silva",
        "-metadata", "copyright=Copyright © 2026 Douglas Coutrim Silva. Patented.",
        "-t", str(replay_seconds),
        "-shortest",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac",
        "-movflags", "+faststart",
        str(output_path),
    ]

    cmd_str = " ".join(str(a) for a in cmd)
    log.info("=== FFMPEG COMMAND ===")
    log.info("%s", cmd_str)
    log.info("=== FILTER COMPLEX ===")
    log.info("%s", filter_complex)
    log.info("======================")
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
        log.critical(
            "CRITICAL ERROR — ffmpeg retornou codigo %d | stderr: %s",
            proc.returncode, proc.stderr[-2000:],
        )
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
    except Exception:
        return None
