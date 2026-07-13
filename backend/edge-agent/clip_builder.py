"""
© 2026 Looplance. All Rights Reserved.
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
  patrocinadores reais por um PNG de teste (retângulo vermelho 1080×240
  com texto "TESTE"). Útil para isolar problemas entre os arquivos de
  logo baixados e o filter_complex do FFmpeg.

O caller eh responsavel por apagar o mp4 final depois do upload.
"""
from __future__ import annotations

import logging
import os
import subprocess
import time
import uuid
from pathlib import Path

from config import CameraConfig, Settings

SPONSOR_DIR = Path("/opt/looplance-edge/sponsors")

CANVAS_W = 1080
CANVAS_H = 1920
VIDEO_AREA_W = 1080
VIDEO_AREA_H = 1440
VIDEO_OFFSET_Y = 240   # 240px top + 240px bottom = 480px para logos

# Tamanho minimo em bytes para um arquivo de logo ser valido
# (abaixo disso provavelmente é HTML de erro 403/404 salvo com extensao .png)
MIN_LOGO_SIZE = 100

log = logging.getLogger("looplance.clip")


class ClipBuildError(RuntimeError):
    pass


def _probe_video_dims(paths: list[Path]) -> tuple[int, int]:
    """Detecta largura e altura reais do video de entrada via ffprobe.

    Percorre os segmentos até encontrar um arquivo válido e lê as
    dimensões do primeiro stream de video. Retorna (width, height).
    Fallback: (1920, 1080) se não conseguir ler.
    """
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
                parts = raw.split(",")
                w, h = int(parts[0]), int(parts[1])
                if w > 0 and h > 0:
                    return w, h
        except Exception:
            continue
    return 1920, 1080


def _aspect_label(w: int, h: int) -> str:
    """Retorna rótulo legível da proporção (ex: '16:9', '9:16', '4:3')."""
    from math import gcd
    g = gcd(w, h)
    return f"{w // g}:{h // g}"


def _generate_test_overlay(tmp_dir: Path) -> list[dict]:
    """Gera um PNG de diagnostico 1080x240 com fundo vermelho e texto TESTE.

    Usa o proprio FFmpeg para renderizar. Se drawtext falhar (fontconfig
    ausente), cai para um retangulo solido vermelho. O PNG eh gerado uma
    unica vez e reusado nas chamadas seguintes.

    Retorna lista com um unico dict no formato de _validate_sponsor_files
    (position_index=1, ou seja, topo).
    """
    test_path = tmp_dir / "test_overlay.png"
    if test_path.is_file() and test_path.stat().st_size > 100:
        log.info("[test] overlay de teste ja existe: %s", test_path)
        return [{"path": str(test_path.resolve()), "position_index": 1}]

    log.info("[test] gerando overlay de teste em %s ...", test_path)

    # Tenta com drawtext (precisa de fontconfig)
    fonts = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    fontfile = None
    for fp in fonts:
        if Path(fp).is_file():
            fontfile = fp
            break

    if fontfile:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=red:s=1080x240:d=1",
            "-vf", f"drawtext=text='TESTE':fontsize=80:fontcolor=white:"
                   f"x=(w-text_w)/2:y=(h-text_h)/2:fontfile={fontfile}",
            "-frames:v", "1",
            str(test_path),
        ]
    else:
        # Fallback: retangulo vermelho solido com bordas
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i",
            "color=c=red:s=1080x240:d=1",
            "-vf",
            "drawbox=x=10:y=10:w=1060:h=220:color=white@0.8:w=4,"
            "drawbox=x=20:y=20:w=1040:h=200:color=yellow@0.6:w=2",
            "-frames:v", "1",
            str(test_path),
        ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if proc.returncode != 0 or not test_path.is_file():
            log.warning("[test] ffmpeg falhou ao gerar overlay: %s", proc.stderr[-500:])
            # Ultimo fallback: PNG 1x1 pixel vermelho (minimo via python)
            _write_fallback_png(test_path)
    except Exception as exc:
        log.warning("[test] excecao ao gerar overlay: %s", exc)
        _write_fallback_png(test_path)

    size = test_path.stat().st_size if test_path.is_file() else 0
    log.info("[test] overlay gerado: %s (%d bytes)", test_path, size)
    return [{"path": str(test_path.resolve()), "position_index": 1}]


def _write_fallback_png(path: Path) -> None:
    """Cria um PNG vermelho 1080x240 via Python puro (fallback extremo)."""
    import struct, zlib

    def _chunk(tag: bytes, data: bytes) -> bytes:
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = _chunk(b"IHDR", struct.pack(">IIBBBBB", 1080, 240, 8, 2, 0, 0, 0))
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * 1080 for _ in range(240))
    idat = _chunk(b"IDAT", zlib.compress(raw))
    iend = _chunk(b"IEND", b"")
    path.write_bytes(sig + ihdr + idat + iend)


def _validate_sponsor_files(arena_id: str, tmp_dir: Path | None = None) -> list[dict]:
    """Varre o SSD em busca de slot_{position_index}.png.

    Retorna lista de dicts {path, position_index}
    apenas para arquivos que existem fisicamente, nao estao vazios
    e tem tamanho >= MIN_LOGO_SIZE (filtra HTML de erro salvos como PNG).
    Retorna lista vazia se nada for encontrado.
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
            log.warning("[sponsor] %s nao eh um arquivo regular — ignorado", abs_path)
            continue
        if size < MIN_LOGO_SIZE:
            log.warning(
                "[sponsor] %s muito pequeno (%d bytes) — provavelmente corrompido, ignorado",
                abs_path, size,
            )
            continue

        result.append({
            "path": abs_path,
            "position_index": pos,
        })

    if not result:
        log.warning("[sponsor] nenhum arquivo de logo valido encontrado em %s", arena_dir)

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

    # ── Detecta dimensoes reais do video ──────────────────────────────
    in_w, in_h = _probe_video_dims(valid_segments)
    aspect = _aspect_label(in_w, in_h)
    log.info(
        "Camera %s — video detectado: %dx%d (%s)",
        camera.name, in_w, in_h, aspect,
    )

    tmp_dir = settings.ram_buffer_dir / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    clip_id = uuid.uuid4().hex
    concat_list = tmp_dir / f"{clip_id}_list.txt"
    concat_list.write_text("".join(f"file '{s.resolve()}'\n" for s in valid_segments))

    output_path = tmp_dir / f"{clip_id}.mp4"
    replay_seconds = camera.replay_seconds
    arena_id = camera.arena_id

    log.info("Iniciando renderizacao de arena: %s | camera: %s", arena_id, camera.name)

    # ── Valida arquivos de patrocinadores ─────────────────────────────
    # Modo diagnostico: LOOPLANCE_TEST_OVERLAY=1 substitui logos reais
    # por um PNG de teste (retangulo vermelho com texto "TESTE").
    if os.environ.get("LOOPLANCE_TEST_OVERLAY") == "1":
        log.warning("[TEST] LOOPLANCE_TEST_OVERLAY=1 — usando overlay de teste em vez dos patrocinadores reais")
        sponsor_files = _generate_test_overlay(tmp_dir)
    else:
        sponsor_files = _validate_sponsor_files(arena_id, tmp_dir)
    top_sponsors = [s for s in sponsor_files if s["position_index"] % 2 == 1]
    bottom_sponsors = [s for s in sponsor_files if s["position_index"] % 2 == 0]
    log.info(
        "[sponsor] %d arquivos validos (%d topo, %d rodape)",
        len(sponsor_files), len(top_sponsors), len(bottom_sponsors),
    )

    overlay_url = camera.final_overlay_url or camera.overlay_url
    has_overlay = bool(overlay_url)

    # ── Montagem dos inputs ──────────────────────────────────────────
    # Ordem: [0] canvas preto, [1] concat video, [2..] logos (topo + rodape)
    inputs = [
        "-f", "lavfi", "-i", f"color=c=black:s={CANVAS_W}x{CANVAS_H}:r=30:d=30",
        "-sseof", f"-{replay_seconds}",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
    ]
    # Logos do topo primeiro, depois rodapé — position_index ímpar = topo, par = rodapé
    for sf in top_sponsors + bottom_sponsors:
        inputs += ["-loop", "1", "-i", sf["path"]]

    if has_overlay:
        inputs += ["-loop", "1", "-i", overlay_url]

    # ── Indices dos inputs ────────────────────────────────────────────
    #  0: canvas preto
    #  1: concat video
    #  2 .. 2+N-1: logos (topo + rodapé)
    #  2+N: overlay_url (opcional)
    n_logos = len(sponsor_files)
    overlay_input_idx = 2 + n_logos

    # ── Filtro complexo ──────────────────────────────────────────────
    # Pipeline:
    #   1) scale + pad do video para caber em 1080x1440 (centralizado)
    #   2) overlay do video sobre o canvas em y=240
    #   3) overlay dos logos do topo
    #   4) overlay dos logos do rodapé
    #   5) overlay_url opcional por cima de tudo
    parts = []

    # 1) Normaliza video para 1080x1440 (force_original_aspect_ratio + pad)
    parts.append(
        f"[1:v]scale={VIDEO_AREA_W}:{VIDEO_AREA_H}:"
        f"force_original_aspect_ratio=decrease[vid_scaled]"
    )
    parts.append(
        f"[vid_scaled]pad={VIDEO_AREA_W}:{VIDEO_AREA_H}:"
        f"(ow-iw)/2:(oh-ih)/2:color=black[vid_padded]"
    )

    # 2) Overlay do video sobre o canvas
    parts.append(
        f"[0:v][vid_padded]overlay=0:{VIDEO_OFFSET_Y}[base]"
    )
    cur = "[base]"

    # 3) Logos do topo (y ~ 50px)
    for i, sf in enumerate(top_sponsors):
        idx = 2 + i  # top_sponsors vem primeiro em inputs
        logo_h = 140
        parts.append(f"[{idx}:v]scale=-1:{logo_h}[sp_t{i}]")
        n_top = len(top_sponsors)
        if n_top == 1:
            x_expr = f"({VIDEO_AREA_W}-iw)/2"
        else:
            x_expr = str(i * (VIDEO_AREA_W // n_top) + 20)
        out = "[v_topo]" if i == n_top - 1 and not bottom_sponsors else f"[v_tt{i}]"
        parts.append(f"{cur}[sp_t{i}]overlay={x_expr}:50{out}")
        cur = out

    # 4) Logos do rodapé (y ~ 1700px)
    offset_top = len(top_sponsors)
    for j, sf in enumerate(bottom_sponsors):
        idx = 2 + offset_top + j  # bottom_sponsors depois dos topo
        logo_h = 140
        parts.append(f"[{idx}:v]scale=-1:{logo_h}[sp_b{j}]")
        n_bot = len(bottom_sponsors)
        if n_bot == 1:
            x_expr = f"({VIDEO_AREA_W}-iw)/2"
        else:
            x_expr = str(j * (VIDEO_AREA_W // n_bot) + 20)
        out = "[v_base]" if j == n_bot - 1 else f"[v_bb{j}]"
        parts.append(f"{cur}[sp_b{j}]overlay={x_expr}:1700{out}")
        cur = out

    # 5) overlay_url opcional (per-camera branding) no topo de tudo
    if has_overlay:
        ov_w = camera.video_width or "iw"
        ov_h = camera.video_height or "ih"
        ov_x = camera.video_x or 0
        ov_y = camera.video_y or 0
        parts.append(f"[{overlay_input_idx}:v]scale={ov_w}:{ov_h}[ov]")
        parts.append(f"{cur}[ov]overlay={ov_x}:{ov_y}[v_final]")
        last_label = "[v_final]"
    else:
        last_label = cur

    filter_complex = ";".join(parts)

    # ── Montagem do comando final ────────────────────────────────────
    cmd = ["ffmpeg", "-y", "-nostdin", *inputs]
    cmd += [
        "-filter_complex", filter_complex,
        "-map", last_label,
        "-map", "1:a?",
    ]
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

    # Salva comando em arquivo para execucao manual
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

    t0 = time.time()

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
    except subprocess.TimeoutExpired:
        concat_list.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
        raise ClipBuildError("ffmpeg timed out after 45s")

    if proc.returncode != 0 or not output_path.exists():
        # Salva stderr completo para debug
        stderr_log_path = tmp_dir / f"{clip_id}_ffmpeg_stderr.txt"
        stderr_log_path.write_text(proc.stderr or "(empty)")
        log.critical(
            "CRITICAL ERROR — ffmpeg retornou codigo %d | stderr salvo em %s",
            proc.returncode, stderr_log_path,
        )
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
    except Exception:
        return None
