"""
(c) 2026 Looplance. All Rights Reserved.
Developed & Patented by Douglas Coutrim Silva.

Monta o replay final a partir dos segmentos em RAM:
  1. concatena os segmentos relevantes (concat demuxer)
  2. corta para exatamente `replay_seconds` (a partir do fim)
  3. escala o video para caber na area central 1080x1440 com pad
     (funciona para 16:9, 9:16, 4:3 — SEMPRE centralizado sem distorcer)
  4. queima os overlays dos patrocinadores (slot_*.png) nas faixas
     superior (240px) e inferior (240px) do canvas 1080x1920
  5. grava o mp4 final em tmpfs

MODO DE DIAGNÓSTICO:
  Defina LOOPLANCE_TEST_OVERLAY=1 no environment para substituir os
  patrocinadores reais por um PNG de teste (retângulo vermelho 1080x240
  com texto "TESTE"). Util para isolar problemas entre os arquivos de
  logo baixados e o filter_complex do FFmpeg.

O caller eh responsavel por apagar o mp4 final depois do upload.
"""
from __future__ import annotations

import logging
import os
import subprocess
import time
import uuid
from math import gcd
from pathlib import Path

from config import CameraConfig, Settings

SPONSOR_DIR = Path("/opt/looplance-edge/sponsors")

# ── Output canvas (sempre 9:16 para redes sociais) ─────────────────────────
CANVAS_W = 1080
CANVAS_H = 1920
VIDEO_AREA_W = 1080
VIDEO_AREA_H = 1440         # 1920 - 240 - 240
VIDEO_OFFSET_Y = 240        # banner superior em px

BANNER_H = 240              # altura de cada faixa (topo / rodape)
LOGO_MAX_H = 160            # altura maxima de cada logo (proporcional ao canvas)

MIN_LOGO_SIZE = 100         # bytes minimos para um PNG valido
ASSETS_DIR = Path("/opt/looplance-edge/assets")

log = logging.getLogger("looplance.clip")


# ═══════════════════════════════════════════════════════════════════════════════
# Excecoes
# ═══════════════════════════════════════════════════════════════════════════════

class ClipBuildError(RuntimeError):
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# Utilitarios FFprobe
# ═══════════════════════════════════════════════════════════════════════════════

def _aspect_label(w: int, h: int) -> str:
    g = gcd(w, h)
    return f"{w // g}:{h // g}"


def _probe_video_dims(paths: list[Path]) -> tuple[int, int]:
    """Retorna (width, height) do primeiro segmento valido. Fallback (1920,1080)."""
    for p in paths:
        if not p.exists() or p.stat().st_size == 0:
            continue
        try:
            proc = subprocess.run(
                [
                    "ffprobe", "-v", "error",
                    "-select_streams", "v:0",
                    "-show_entries", "stream=width,height",
                    "-of", "csv=p=0",
                    str(p),
                ],
                capture_output=True, text=True, timeout=10,
            )
            raw = proc.stdout.strip()
            if raw and "," in raw:
                w, h = raw.split(",")
                wi, hi = int(w), int(h)
                if wi > 0 and hi > 0:
                    return wi, hi
        except Exception:
            continue
    return 1920, 1080


def _probe_duration(path: Path) -> float | None:
    try:
        proc = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True, text=True, timeout=10,
        )
        return float(proc.stdout.strip())
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# Overlay de teste (diagnostico)
# ═══════════════════════════════════════════════════════════════════════════════

def _generate_test_overlay(tmp_dir: Path) -> list[dict]:
    """Retorna um dict de sponsor com fundo vermelho + 'TESTE' para debug."""
    test_path = tmp_dir / "test_overlay.png"
    if test_path.is_file() and test_path.stat().st_size > 100:
        return [{"path": str(test_path.resolve()), "position_index": 1}]

    log.info("[test] gerando overlay de teste em %s ...", test_path)

    fonts = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    fontfile = next((fp for fp in fonts if Path(fp).is_file()), None)

    if fontfile:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=red:s={CANVAS_W}x{BANNER_H}:d=1",
            "-vf", f"drawtext=text='TESTE':fontsize=80:fontcolor=white:"
                   f"x=(w-text_w)/2:y=(h-text_h)/2:fontfile={fontfile}",
            "-frames:v", "1",
            str(test_path),
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i",
            f"color=c=red:s={CANVAS_W}x{BANNER_H}:d=1",
            "-vf",
            "drawbox=x=10:y=10:w=1060:h=220:color=white@0.8:w=4,"
            "drawbox=x=20:y=20:w=1040:h=200:color=yellow@0.6:w=2",
            "-frames:v", "1",
            str(test_path),
        ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if proc.returncode != 0 or not test_path.is_file():
            _write_fallback_png(test_path, CANVAS_W, BANNER_H)
    except Exception:
        _write_fallback_png(test_path, CANVAS_W, BANNER_H)

    return [{"path": str(test_path.resolve()), "position_index": 1}]


def _write_fallback_png(path: Path, w: int, h: int) -> None:
    """Cria um PNG vermelho via Python puro."""
    import struct, zlib
    def _chunk(tag: bytes, data: bytes) -> bytes:
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = _chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * w for _ in range(h))
    idat = _chunk(b"IDAT", zlib.compress(raw))
    iend = _chunk(b"IEND", b"")
    path.write_bytes(sig + ihdr + idat + iend)


# ═══════════════════════════════════════════════════════════════════════════════
# Placeholders
# ═══════════════════════════════════════════════════════════════════════════════

def _ensure_placeholders() -> tuple[Path, Path]:
    """Garante que assets/default_top.png e default_bottom.png existam.

    Se nao existirem, gera PNGs simples com cor solida e texto via FFmpeg
    (ou fallback Python puro). Retorna (top_path, bottom_path).
    """
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    top = ASSETS_DIR / "default_top.png"
    bot = ASSETS_DIR / "default_bottom.png"

    for path, label, color in [
        (top, "TOP", "blue"),
        (bot, "BOTTOM", "green"),
    ]:
        if path.is_file() and path.stat().st_size > 100:
            continue
        log.info("[placeholder] gerando %s ...", path)
        _generate_placeholder(path, label, color)

    return top, bot


def _generate_placeholder(path: Path, label: str, color: str) -> None:
    """Gera PNG placeholder com cor solida e texto centralizado."""
    fonts = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    fontfile = next((fp for fp in fonts if Path(fp).is_file()), None)

    if fontfile:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i",
            f"color=c={color}:s={CANVAS_W}x{BANNER_H}:d=1",
            "-vf", f"drawtext=text='{label}':fontsize=48:fontcolor=white:"
                   f"x=(w-text_w)/2:y=(h-text_h)/2:fontfile={fontfile}",
            "-frames:v", "1",
            str(path),
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if proc.returncode == 0 and path.is_file():
                return
        except Exception:
            pass

    # Fallback: PNG solido
    _write_fallback_png(path, CANVAS_W, BANNER_H)


# ═══════════════════════════════════════════════════════════════════════════════
# Busca de patrocinadores
# ═══════════════════════════════════════════════════════════════════════════════

def _validate_sponsor_files(arena_id: str) -> list[dict]:
    """Varre o SSD por slot_{position_index}.png. Retorna lista de dicts."""
    arena_dir = SPONSOR_DIR / arena_id
    if not arena_dir.is_dir():
        log.info("[sponsor] diretorio %s nao existe", arena_dir)
        return []

    found = sorted(arena_dir.glob("slot_*.png"))
    if not found:
        log.info("[sponsor] nenhum slot_*.png em %s", arena_dir)
        return []

    result: list[dict] = []
    for f in found:
        try:
            pos = int(f.stem.replace("slot_", ""))
        except (ValueError, IndexError):
            log.warning("[sponsor] nome invalido ignorado: %s", f.name)
            continue

        size = f.stat().st_size if f.is_file() else 0
        abs_path = str(f.resolve())
        log.info(
            "[sponsor] arena=%s file=%s size=%d bytes path=%s pos=%d",
            arena_id, f.name, size, abs_path, pos,
        )

        if not f.is_file():
            log.warning("[sponsor] %s nao eh arquivo regular", abs_path)
            continue
        if size < MIN_LOGO_SIZE:
            log.warning("[sponsor] %s muito pequeno (%d bytes) — ignorado", abs_path, size)
            continue

        result.append({"path": abs_path, "position_index": pos})

    if not result:
        log.warning("[sponsor] nenhum logo valido em %s", arena_dir)

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Montagem do clipe (funcao principal)
# ═══════════════════════════════════════════════════════════════════════════════

def build_clip(settings: Settings, camera: CameraConfig, segments: list[Path]) -> tuple[Path, float]:
    _validate_segments(camera, segments)

    # ── Detecta dimensoes reais do video ──────────────────────────────
    in_w, in_h = _probe_video_dims(segments)
    aspect = _aspect_label(in_w, in_h)

    tmp_dir = settings.ram_buffer_dir / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    clip_id = uuid.uuid4().hex
    concat_list = tmp_dir / f"{clip_id}_list.txt"
    valid_segments = [s for s in segments if s.exists()]
    concat_list.write_text("".join(f"file '{s.resolve()}'\n" for s in valid_segments))

    output_path = tmp_dir / f"{clip_id}.mp4"
    replay_seconds = camera.replay_seconds
    arena_id = camera.arena_id

    # ── Log estruturado inicial ───────────────────────────────────────
    build_plan = _build_plan_log(camera, in_w, in_h, aspect, replay_seconds, output_path)

    # ── Patrocinadores / placeholders ─────────────────────────────────
    sponsor_files, top_sponsors, bottom_sponsors = _resolve_sponsors(arena_id, tmp_dir, build_plan)

    # ── Overlay URL (watermark por camera) ─────────────────────────────
    overlay_url = camera.final_overlay_url or camera.overlay_url
    has_overlay = bool(overlay_url)

    # ── Inputs ────────────────────────────────────────────────────────
    # Ordem: [0] canvas, [1] concat video, [2..N] logos sem -loop
    inputs = _build_inputs(replay_seconds, concat_list, top_sponsors, bottom_sponsors, has_overlay, overlay_url)
    n_logos = len(sponsor_files)
    overlay_input_idx = 2 + n_logos

    # ── Filter complex ────────────────────────────────────────────────
    filter_complex, last_label = _build_filter_complex(
        sponsor_files, top_sponsors, bottom_sponsors,
        has_overlay, overlay_input_idx, overlay_url, camera,
    )

    build_plan["filter_complex"] = filter_complex
    build_plan["sponsors_top"] = [s["path"] for s in top_sponsors]
    build_plan["sponsors_bottom"] = [s["path"] for s in bottom_sponsors]

    # ── Comando FFmpeg ────────────────────────────────────────────────
    cmd = _build_ffmpeg_cmd(inputs, filter_complex, last_label, replay_seconds, output_path)

    cmd_str = " ".join(str(a) for a in cmd)
    build_plan["ffmpeg_command"] = cmd_str

    _log_build_plan(build_plan)

    # ── Salva comando para debug ──────────────────────────────────────
    _save_cmd_log(tmp_dir, clip_id, camera, arena_id, in_w, in_h, aspect, filter_complex, cmd_str, output_path)

    # ── Executa ───────────────────────────────────────────────────────
    t0 = time.time()
    proc = _run_ffmpeg(cmd, tmp_dir, clip_id, replay_seconds)
    duration = time.time() - t0

    # ── Cleanup ───────────────────────────────────────────────────────
    concat_list.unlink(missing_ok=True)

    # ── Verifica saida ────────────────────────────────────────────────
    fps = _compute_fps(output_path, replay_seconds, duration, proc)
    real_duration = _probe_duration(output_path) or float(replay_seconds)

    log.info(
        "=== BUILD COMPLETE === clip=%s camera=%s arena=%s time=%.2fs fps=%.2f "
        "duration=%.2fs output=%s retexit=%d",
        clip_id, camera.name, arena_id, duration, fps, real_duration,
        output_path, proc.returncode,
    )

    return output_path, real_duration


# ═══════════════════════════════════════════════════════════════════════════════
# Sub-rotinas
# ═══════════════════════════════════════════════════════════════════════════════

def _validate_segments(camera: CameraConfig, segments: list[Path]) -> None:
    if not segments:
        raise ClipBuildError("nenhum segmento disponivel no buffer")

    valid = [s for s in segments if s.exists()]
    if len(valid) < 2:
        raise ClipBuildError(
            f"[{camera.name}] apenas {len(valid)} segmento(s) de {len(segments)} — "
            "insuficiente para montar clipe"
        )

    if len(valid) != len(segments):
        log.warning(
            "[%s] %d segmento(s) reciclado(s), continuando com %d",
            camera.name, len(segments) - len(valid), len(valid),
        )


def _build_plan_log(camera, in_w, in_h, aspect, replay_seconds, output_path) -> dict:
    plan = {
        "arena_id": camera.arena_id,
        "camera_name": camera.name,
        "input_resolution": f"{in_w}x{in_h}",
        "aspect_ratio": aspect,
        "canvas": f"{CANVAS_W}x{CANVAS_H}",
        "video_area": f"{VIDEO_AREA_W}x{VIDEO_AREA_H}",
        "video_offset_y": VIDEO_OFFSET_Y,
        "banner_h": BANNER_H,
        "replay_seconds": replay_seconds,
        "output_path": str(output_path),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    return plan


def _log_build_plan(plan: dict) -> None:
    sep = "=" * 60
    log.info(sep)
    log.info("BUILD START — arena=%(arena_id)s camera=%(camera_name)s", plan)
    log.info("Input Resolution ..: %(input_resolution)s (%(aspect_ratio)s)", plan)
    log.info("Canvas ............: %(canvas)s", plan)
    log.info("Video Area ........: %(video_area)s offset_y=%(video_offset_y)d", plan)
    log.info("Banner Height .....: %(banner_h)d", plan)
    log.info("Replay Seconds ....: %(replay_seconds)d", plan)
    log.info("Output Path .......: %(output_path)s", plan)
    log.info("Timestamp .........: %(timestamp)s", plan)
    if plan.get("sponsors_top"):
        for p in plan["sponsors_top"]:
            log.info("Sponsor Top .......: %s", p)
    if plan.get("sponsors_bottom"):
        for p in plan["sponsors_bottom"]:
            log.info("Sponsor Bottom ....: %s", p)
    log.info("Filter Complex ....: %s", plan.get("filter_complex", ""))
    log.info("FFmpeg Command ....: %s", plan.get("ffmpeg_command", ""))
    log.info(sep)


def _resolve_sponsors(arena_id: str, tmp_dir: Path, plan: dict) -> tuple[list[dict], list[dict], list[dict]]:
    """Retorna (all_sponsors, top_sponsors, bottom_sponsors) com fallback
    para placeholders e modo diagnostico."""
    if os.environ.get("LOOPLANCE_TEST_OVERLAY") == "1":
        log.warning("[TEST] LOOPLANCE_TEST_OVERLAY=1 — overlay de teste")
        sponsor_files = _generate_test_overlay(tmp_dir)
    else:
        sponsor_files = _validate_sponsor_files(arena_id) or _use_placeholders()

    top_sponsors = [s for s in sponsor_files if s["position_index"] % 2 == 1]
    bottom_sponsors = [s for s in sponsor_files if s["position_index"] % 2 == 0]

    if not top_sponsors and not bottom_sponsors:
        log.warning("[sponsor] nenhum patrocinador — usando placeholders")
        sponsor_files = _use_placeholders()
        top_sponsors = [s for s in sponsor_files if s["position_index"] % 2 == 1]
        bottom_sponsors = [s for s in sponsor_files if s["position_index"] % 2 == 0]

    plan["sponsor_count"] = len(sponsor_files)
    plan["sponsor_top_count"] = len(top_sponsors)
    plan["sponsor_bottom_count"] = len(bottom_sponsors)

    log.info(
        "[sponsor] %d arquivos (%d topo, %d rodape)",
        len(sponsor_files), len(top_sponsors), len(bottom_sponsors),
    )

    return sponsor_files, top_sponsors, bottom_sponsors


def _use_placeholders() -> list[dict]:
    top, bot = _ensure_placeholders()
    return [
        {"path": str(top), "position_index": 1},
        {"path": str(bot), "position_index": 2},
    ]


def _build_inputs(replay_seconds, concat_list, top_sponsors, bottom_sponsors, has_overlay, overlay_url) -> list:
    inputs = [
        "-f", "lavfi", "-i",
        f"color=c=black:s={CANVAS_W}x{CANVAS_H}:r=30:d={replay_seconds}",
        "-sseof", f"-{replay_seconds}",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
    ]

    # Logos SEM -loop 1 — cada PNG é 1 frame; com eof_action=pass,
    # o overlay termina quando o frame acaba e deixa o video passar.
    for sf in top_sponsors + bottom_sponsors:
        inputs += ["-i", sf["path"]]

    if has_overlay:
        inputs += ["-i", overlay_url]

    return inputs


def _build_filter_complex(
    sponsor_files, top_sponsors, bottom_sponsors,
    has_overlay, overlay_input_idx, overlay_url, camera,
) -> tuple[str, str]:
    """Monta o grafo de filtros e retorna (filter_complex_str, ultimo_label)."""
    parts = []

    # 1) Normaliza video para caber na area 1080x1440
    parts.append(
        f"[1:v]scale={VIDEO_AREA_W}:{VIDEO_AREA_H}:"
        f"force_original_aspect_ratio=decrease[vid_scaled]"
    )
    parts.append(
        f"[vid_scaled]pad={VIDEO_AREA_W}:{VIDEO_AREA_H}:"
        f"(ow-iw)/2:(oh-ih)/2:color=black[vid_padded]"
    )

    # 2) Overlay do video sobre o canvas
    #    eof_action=pass: quando canvas ou video acabar, passa o outro
    parts.append(
        f"[0:v][vid_padded]overlay=0:{VIDEO_OFFSET_Y}:eof_action=pass[base]"
    )
    cur = "[base]"

    # 3) Logos do topo
    cur = _append_logo_overlays(
        parts, top_sponsors, cur, is_top=True, n_prev=0,
    )

    # 4) Logos do rodape
    cur = _append_logo_overlays(
        parts, bottom_sponsors, cur, is_top=False, n_prev=len(top_sponsors),
    )

    # 5) overlay_url opcional (watermark por camera)
    if has_overlay:
        ov_w = camera.video_width or "iw"
        ov_h = camera.video_height or "ih"
        ov_x = camera.video_x or 0
        ov_y = camera.video_y or 0
        parts.append(f"[{overlay_input_idx}:v]scale={ov_w}:{ov_h}[ov]")
        parts.append(f"{cur}[ov]overlay={ov_x}:{ov_y}:eof_action=pass[v_final]")
        last_label = "[v_final]"
    else:
        last_label = cur

    return ";".join(parts), last_label


def _append_logo_overlays(
    parts: list, logos: list[dict], cur: str, *,
    is_top: bool, n_prev: int,
) -> str:
    """Adiciona overlays de logos (topo ou rodape) ao filter complex.

    Cada logo:
      - scale proporcional a altura fixa (LOGO_MAX_H)
      - eof_action=pass para terminar quando o video acabar
      - posicionamento calculado: distribuicao uniforme na faixa,
        centralizado verticalmente, com espacamento proporcional

    Retorna o label de saida (ultimo no do grafo).
    """
    n = len(logos)
    if n == 0:
        return cur

    for i, sf in enumerate(logos):
        idx = 2 + n_prev + i  # indice real no array de inputs
        label_in = f"[sp_{'t' if is_top else 'b'}{i}]"
        parts.append(f"[{idx}:v]scale=-1:{LOGO_MAX_H}:force_original_aspect_ratio=decrease{label_in}")

        # Posicao X: distribuicao uniforme na largura do canvas
        if n == 1:
            x_expr = f"({CANVAS_W}-iw)/2"
        else:
            # Divide o canvas em N+1 espacos iguais, coloca cada logo
            # no centro de cada fracao
            slot_w = CANVAS_W // (n + 1)
            x_expr = str(slot_w * (i + 1) - 50)  # ~centro do slot

        # Posicao Y: centralizado verticalmente na faixa
        if is_top:
            y_expr = f"({BANNER_H}-ih)/2"
        else:
            y_expr = f"({CANVAS_H}-{BANNER_H})+({BANNER_H}-ih)/2"

        label_out = f"[v_{'t' if is_top else 'b'}{i}]"
        parts.append(f"{cur}{label_in}overlay={x_expr}:{y_expr}:eof_action=pass{label_out}")
        cur = label_out

    return cur


def _build_ffmpeg_cmd(inputs, filter_complex, last_label, replay_seconds, output_path) -> list:
    cmd = ["ffmpeg", "-y", "-nostdin", *inputs]
    cmd += [
        "-filter_complex", filter_complex,
        "-map", last_label,
        "-map", "1:a?",
    ]
    cmd += [
        "-metadata", "title=Looplance Replay",
        "-metadata", "artist=Douglas Coutrim Silva",
        "-metadata", "copyright=Copyright (c) 2026 Douglas Coutrim Silva. Patented.",
        "-t", str(replay_seconds),
        "-shortest",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac",
        "-movflags", "+faststart",
        str(output_path),
    ]
    return cmd


def _save_cmd_log(tmp_dir, clip_id, camera, arena_id, in_w, in_h, aspect, filter_complex, cmd_str, output_path) -> None:
    cmd_log_path = tmp_dir / f"{clip_id}_ffmpeg_cmd.txt"
    cmd_log_path.write_text(
        "#!/usr/bin/env bash\n"
        "# Looplance clip builder — comando FFmpeg gerado\n"
        f"# Camera: {camera.name}  Arena: {arena_id}\n"
        f"# Video detectado: {in_w}x{in_h} ({aspect})\n"
        f"# Gerado em: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}\n"
        f"#\n"
        f"# Para executar manualmente:\n"
        f"#   cd {tmp_dir} && bash {cmd_log_path.name}\n"
        f"#\n"
        f"# Filter complex:\n"
        f"#   {filter_complex}\n"
        f"#\n"
        f"# Output esperado: {output_path.name}\n"
        f"#\n"
        f"{cmd_str}\n"
    )
    cmd_log_path.chmod(0o755)


def _run_ffmpeg(cmd: list, tmp_dir: Path, clip_id: str, replay_seconds: int) -> subprocess.CompletedProcess:
    """Executa o FFmpeg com timeout proporcional ao replay + margem segura.

    Timeout = max(45, replay_seconds * 2) — um replay de 30s nunca deve
    levar mais que 60s; um de 15s no maximo 30s. Se estourar, o build
    falha com erro claro em vez de ficar preso.
    """
    timeout = max(45, replay_seconds * 2)

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        stderr_log = tmp_dir / f"{clip_id}_ffmpeg_stderr.txt"
        stderr_log.write_text("(timeout — sem stderr capturado)")
        raise ClipBuildError(
            f"ffmpeg timed out after {timeout}s (replay={replay_seconds}s) — "
            f"provavelmente eof_action=repeat mantendo stream aberto. "
            f"stderr salvo em {stderr_log}"
        )

    if proc.returncode != 0:
        stderr_log = tmp_dir / f"{clip_id}_ffmpeg_stderr.txt"
        stderr_log.write_text(proc.stderr or "(empty)")
        raise ClipBuildError(
            f"ffmpeg retornou codigo {proc.returncode} | stderr salvo em {stderr_log}"
        )

    return proc


def _compute_fps(output_path: Path, replay_seconds: int, elapsed: float, proc) -> float:
    """Estima FPS de codificacao a partir do output."""
    if elapsed <= 0:
        return 0.0
    real = _probe_duration(output_path)
    frames = (real or replay_seconds) * 30
    return frames / elapsed
