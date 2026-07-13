"""
Test suite para o pipeline de renderizacao do clip_builder.

Uso:
    python test_clip_builder.py          # roda todos os testes
    python test_clip_builder.py Teste1   # roda um teste especifico

Pre-requisitos:
    - ffmpeg / ffprobe no PATH
    - Python 3.10+
"""
from __future__ import annotations

import logging
import os
import subprocess
import sys
import time
import tempfile
from pathlib import Path
from typing import ClassVar

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
log = logging.getLogger("test")


# ═══════════════════════════════════════════════════════════════════════════════
# Utilitarios
# ═══════════════════════════════════════════════════════════════════════════════

def _ffmpeg_available() -> bool:
    """Verifica se ffmpeg e ffprobe estao no PATH."""
    for exe in ("ffmpeg", "ffprobe"):
        try:
            subprocess.run([exe, "-version"], capture_output=True, timeout=5)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
    return True


def _gen_test_video(path: Path, w: int, h: int, dur: int = 10, rate: int = 30) -> Path:
    """Gera um video de teste com temporizador digital (para validar duracao)."""
    log.info("  gerando video %dx%d %ds ...", w, h, dur)
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i",
            f"testsrc2=size={w}x{h}:rate={rate}:duration={dur}",
            "-f", "lavfi", "-i",
            f"anoisesrc=d={dur}:r=1",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
            "-c:a", "aac",
            "-shortest",
            str(path),
        ],
        capture_output=True, check=True, timeout=dur + 15,
    )
    log.info("  video gerado: %s (%d bytes)", path, path.stat().st_size)
    return path


def _gen_test_png(path: Path, w: int, h: int, color: str, label: str = "") -> Path:
    """Gera um PNG de teste com cor solida e texto opcional."""
    if label:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c={color}:s={w}x{h}:d=1",
            "-vf", f"drawtext=text='{label}':fontsize=30:fontcolor=white:"
                   f"x=(w-text_w)/2:y=(h-text_h)/2:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "-frames:v", "1", str(path),
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c={color}:s={w}x{h}:d=1",
            "-frames:v", "1", str(path),
        ]
    subprocess.run(cmd, capture_output=True, check=True, timeout=10)
    log.info("  PNG gerado: %s (%s x %s, %s)", path.name, w, h, color)
    return path


def _probe_duration(path: Path) -> float:
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, timeout=10,
    )
    return float(proc.stdout.strip())


def _probe_resolution(path: Path) -> tuple[int, int]:
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, timeout=10,
    )
    w, h = proc.stdout.strip().split(",")
    return int(w), int(h)


# ═══════════════════════════════════════════════════════════════════════════════
# Suite de testes
# ═══════════════════════════════════════════════════════════════════════════════

ALL_TESTS: list[str] = []


def register(fn):
    ALL_TESTS.append(fn.__name__)
    return fn


def run_test(name: str, fn) -> bool:
    log.info("")
    log.info("=" * 60)
    log.info("TESTE: %s", name)
    log.info("=" * 60)

    t0 = time.time()
    try:
        fn()
        elapsed = time.time() - t0
        log.info("RESULTADO: %s — PASS (%.2fs)", name, elapsed)
        return True
    except Exception as e:
        elapsed = time.time() - t0
        log.error("RESULTADO: %s — FAIL (%.2fs): %s", name, elapsed, e)
        return False


# ── TESTE 1: Canvas + Video (sem patrocinadores) ─────────────────────────────

@register
def Teste1():
    """Canvas + Video + Output. Sem logos. Mede tempo, FPS, duracao."""
    REPLAY_S = 5
    with tempfile.TemporaryDirectory(prefix="test_clip_") as tmp:
        tmp_dir = Path(tmp)
        video = _gen_test_video(tmp_dir / "input.mp4", 1920, 1080, REPLAY_S)

        # Concatena o proprio video como segmentos (simula buffer circular)
        segs = [video]

        cmd = [
            "ffmpeg", "-y", "-nostdin",
            "-f", "lavfi", "-i",
            f"color=c=black:s=1080x1920:r=30:d={REPLAY_S}",
            "-sseof", f"-{REPLAY_S}",
            "-f", "concat", "-safe", "0",
            "-i", str(video),
            "-filter_complex",
            "[1:v]scale=1080:1440:force_original_aspect_ratio=decrease[vid_scaled];"
            "[vid_scaled]pad=1080:1440:(ow-iw)/2:(oh-ih)/2:color=black[vid_padded];"
            "[0:v][vid_padded]overlay=0:240:eof_action=pass[out]",
            "-map", "[out]",
            "-map", "1:a?",
            "-t", str(REPLAY_S),
            "-shortest",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
            "-c:a", "aac",
            str(tmp_dir / "output.mp4"),
        ]
        t0 = time.time()
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        elapsed = time.time() - t0

        out = tmp_dir / "output.mp4"
        assert proc.returncode == 0, f"ffmpeg falhou (rc={proc.returncode}): {proc.stderr[-500:]}"
        assert out.exists(), "output nao criado"

        dur = _probe_duration(out)
        log.info("  duracao output: %.2fs (esperado ~%ds)", dur, REPLAY_S)
        log.info("  tempo renderizacao: %.2fs", elapsed)
        log.info("  FPS estimado: %.1f", (dur * 30) / elapsed if elapsed > 0 else 0)
        assert abs(dur - REPLAY_S) < 1.0, f"duracao incorreta: {dur} != ~{REPLAY_S}"


# ── TESTE 2: Canvas + Video + 1 PNG vermelho ────────────────────────────────

@register
def Teste2():
    """Canvas + Video + 1 PNG vermelho de teste. Verificar se o PNG aparece."""
    REPLAY_S = 3
    with tempfile.TemporaryDirectory(prefix="test_clip_") as tmp:
        tmp_dir = Path(tmp)
        video = _gen_test_video(tmp_dir / "input.mp4", 1280, 720, REPLAY_S)
        png = _gen_test_png(tmp_dir / "red.png", 1080, 240, "red", "SPONSOR")

        cmd = [
            "ffmpeg", "-y", "-nostdin",
            "-f", "lavfi", "-i",
            f"color=c=black:s=1080x1920:r=30:d={REPLAY_S}",
            "-sseof", f"-{REPLAY_S}",
            "-f", "concat", "-safe", "0",
            "-i", str(video),
            "-i", str(png),                               # sem -loop 1
            "-filter_complex",
            "[1:v]scale=1080:1440:force_original_aspect_ratio=decrease[vid_scaled];"
            "[vid_scaled]pad=1080:1440:(ow-iw)/2:(oh-ih)/2:color=black[vid_padded];"
            "[0:v][vid_padded]overlay=0:240:eof_action=pass[base];"
            "[base][2:v]scale=-1:160[sp_t0];"
            "[base][sp_t0]overlay=(1080-iw)/2:(240-ih)/2:eof_action=pass[out]",
            "-map", "[out]",
            "-map", "1:a?",
            "-t", str(REPLAY_S),
            "-shortest",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
            "-c:a", "aac",
            str(tmp_dir / "output.mp4"),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        out = tmp_dir / "output.mp4"
        assert proc.returncode == 0, f"ffmpeg falhou: {proc.stderr[-500:]}"
        assert out.exists()
        dur = _probe_duration(out)
        assert abs(dur - REPLAY_S) < 1.0, f"duracao incorreta: {dur}"
        log.info("  PNG com overlay rodou sem timeout (%ds)", dur)


# ── TESTE 3: Canvas + Video + 6 PNGs coloridos ──────────────────────────────

@register
def Teste3():
    """6 PNGs coloridos (3 topo, 3 rodape). Validar visualmente."""
    REPLAY_S = 3
    with tempfile.TemporaryDirectory(prefix="test_clip_") as tmp:
        tmp_dir = Path(tmp)
        video = _gen_test_video(tmp_dir / "input.mp4", 1920, 1080, REPLAY_S)

        colors = [
            ("red", "TOP1"), ("green", "TOP2"), ("blue", "TOP3"),
            ("yellow", "BOT1"), ("purple", "BOT2"), ("orange", "BOT3"),
        ]
        pngs = []
        for i, (color, label) in enumerate(colors, start=1):
            p = _gen_test_png(tmp_dir / f"slot_{i}.png", 200, 160, color, label)
            pngs.append(p)

        # Monta filter complex manual para 6 logos
        parts = [
            "[1:v]scale=1080:1440:force_original_aspect_ratio=decrease[vid_scaled]",
            "[vid_scaled]pad=1080:1440:(ow-iw)/2:(oh-ih)/2:color=black[vid_padded]",
            "[0:v][vid_padded]overlay=0:240:eof_action=pass[base]",
        ]

        # Topo: indices 2,3,4
        for i in range(3):
            idx = 2 + i
            parts.append(f"[{idx}:v]scale=-1:160[sp_t{i}]")
            x = 1080 // 4 * (i + 1) - 50
            label = f"[v_tt{i}]"
            parts.append(f"[base][sp_t{i}]overlay={x}:(240-ih)/2:eof_action=pass{label}")

        cur = "[v_tt2]"
        # Rodape: indices 5,6,7
        for j in range(3):
            idx = 5 + j
            parts.append(f"[{idx}:v]scale=-1:160[sp_b{j}]")
            x = 1080 // 4 * (j + 1) - 50
            y = "1920-240+(240-ih)/2"
            label = "[out]" if j == 2 else f"[v_bb{j}]"
            parts.append(f"{cur}[sp_b{j}]overlay={x}:{y}:eof_action=pass{label}")
            cur = label

        filter_complex = ";".join(parts)

        inputs = [
            "-f", "lavfi", "-i",
            f"color=c=black:s=1080x1920:r=30:d={REPLAY_S}",
            "-sseof", f"-{REPLAY_S}",
            "-f", "concat", "-safe", "0",
            "-i", str(video),
        ]
        for p in pngs:
            inputs += ["-i", str(p)]

        cmd = ["ffmpeg", "-y", "-nostdin", *inputs,
               "-filter_complex", filter_complex,
               "-map", "[out]", "-map", "1:a?",
               "-t", str(REPLAY_S), "-shortest",
               "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
               "-c:a", "aac",
               str(tmp_dir / "output.mp4")]

        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        out = tmp_dir / "output.mp4"
        assert proc.returncode == 0, f"ffmpeg falhou: {proc.stderr[-500:]}"
        assert out.exists()
        dur = _probe_duration(out)
        assert abs(dur - REPLAY_S) < 1.0
        log.info("  6 PNGs overlay rodou sem timeout (%ds)", dur)


# ── TESTE 4: Validar resolucao / alpha / formato dos PNGs baixados ──────────

@register
def Teste4():
    """Verifica estrutura dos PNGs baixados (simulados)."""
    with tempfile.TemporaryDirectory(prefix="test_clip_") as tmp:
        tmp_dir = Path(tmp)

        # Simula PNGs baixados
        pngs = {
            "slot_1.png": ("red", "TOP"),
            "slot_2.png": ("green", "BOT"),
        }
        for fname, (color, label) in pngs.items():
            _gen_test_png(tmp_dir / fname, 400, 200, color, label)

        for fname in pngs:
            f = tmp_dir / fname
            assert f.exists(), f"{fname} nao existe"
            size = f.stat().st_size
            assert size > MIN_PNG_SIZE, f"{fname} muito pequeno: {size} bytes"

            # Verifica cabecalho PNG
            header = f.read_bytes()[:8]
            assert header == b"\x89PNG\r\n\x1a\n", f"{fname} nao eh PNG valido"

            log.info("  %s: %d bytes, cabecalho OK", fname, size)


MIN_PNG_SIZE = 50


# ── TESTE 5: Sem -loop 1 (versus com -loop 1) ───────────────────────────────

@register
def Teste5():
    """Renderizar SEM -loop 1 vs COM -loop 1. Comparar tempo."""
    REPLAY_S = 3
    with tempfile.TemporaryDirectory(prefix="test_clip_") as tmp:
        tmp_dir = Path(tmp)
        video = _gen_test_video(tmp_dir / "input.mp4", 1280, 720, REPLAY_S)
        png = _gen_test_png(tmp_dir / "logo.png", 200, 160, "blue", "TESTE")

        results = {}
        for variant, extra_input in [("sem_loop1", []), ("com_loop1", ["-loop", "1"])]:
            inputs = [
                "-f", "lavfi", "-i",
                f"color=c=black:s=1080x1920:r=30:d={REPLAY_S}",
                "-sseof", f"-{REPLAY_S}",
                "-f", "concat", "-safe", "0",
                "-i", str(video),
                *extra_input, "-i", str(png),
            ]
            cmd = [
                "ffmpeg", "-y", "-nostdin", *inputs,
                "-filter_complex",
                "[1:v]scale=1080:1440:force_original_aspect_ratio=decrease[vid_scaled];"
                "[vid_scaled]pad=1080:1440:(ow-iw)/2:(oh-ih)/2:color=black[vid_padded];"
                "[0:v][vid_padded]overlay=0:240:eof_action=pass[base];"
                "[base][2:v]scale=-1:160[sp];"
                "[base][sp]overlay=(1080-iw)/2:(240-ih)/2:eof_action=pass[out]",
                "-map", "[out]", "-map", "1:a?",
                "-t", str(REPLAY_S), "-shortest",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
                "-c:a", "aac",
                str(tmp_dir / f"{variant}.mp4"),
            ]
            t0 = time.time()
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            elapsed = time.time() - t0
            assert proc.returncode == 0, f"{variant} falhou: {proc.stderr[-300:]}"
            results[variant] = elapsed
            log.info("  %s: %.2fs", variant, elapsed)

        log.info("  Diferenca: %.2fs", abs(results.get("sem_loop1", 0) - results.get("com_loop1", 0)))


# ── TESTE 6: -loop 1 com -t replay_seconds ──────────────────────────────────

@register
def Teste6():
    """Usar -loop 1 e limitar com -t replay_seconds. Nao deve travar."""
    REPLAY_S = 3
    with tempfile.TemporaryDirectory(prefix="test_clip_") as tmp:
        tmp_dir = Path(tmp)
        video = _gen_test_video(tmp_dir / "input.mp4", 1920, 1080, REPLAY_S)
        png = _gen_test_png(tmp_dir / "logo.png", 200, 160, "purple", "LOOP")

        cmd = [
            "ffmpeg", "-y", "-nostdin",
            "-f", "lavfi", "-i",
            f"color=c=black:s=1080x1920:r=30:d={REPLAY_S}",
            "-sseof", f"-{REPLAY_S}",
            "-f", "concat", "-safe", "0",
            "-i", str(video),
            "-loop", "1", "-i", str(png),
            "-filter_complex",
            "[1:v]scale=1080:1440:force_original_aspect_ratio=decrease[vid_scaled];"
            "[vid_scaled]pad=1080:1440:(ow-iw)/2:(oh-ih)/2:color=black[vid_padded];"
            "[0:v][vid_padded]overlay=0:240:eof_action=pass[base];"
            "[base][2:v]scale=-1:160[sp];"
            "[base][sp]overlay=(1080-iw)/2:(240-ih)/2:eof_action=pass[out]",
            "-map", "[out]", "-map", "1:a?",
            "-t", str(REPLAY_S),
            "-shortest",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
            "-c:a", "aac",
            str(tmp_dir / "output.mp4"),
        ]
        t0 = time.time()
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        elapsed = time.time() - t0
        out = tmp_dir / "output.mp4"
        assert proc.returncode == 0, f"loop1+t falhou: {proc.stderr[-300:]}"
        assert out.exists()
        log.info("  -loop 1 + -t %ds: %.2fs (OK)", REPLAY_S, elapsed)


# ── TESTE 7: Sem -shortest ──────────────────────────────────────────────────

@register
def Teste7():
    """Renderizar SEM -shortest. Nao deve travar com eof_action=pass."""
    REPLAY_S = 3
    with tempfile.TemporaryDirectory(prefix="test_clip_") as tmp:
        tmp_dir = Path(tmp)
        video = _gen_test_video(tmp_dir / "input.mp4", 1280, 720, REPLAY_S)

        cmd = [
            "ffmpeg", "-y", "-nostdin",
            "-f", "lavfi", "-i",
            f"color=c=black:s=1080x1920:r=30:d={REPLAY_S}",
            "-sseof", f"-{REPLAY_S}",
            "-f", "concat", "-safe", "0",
            "-i", str(video),
            "-filter_complex",
            "[1:v]scale=1080:1440:force_original_aspect_ratio=decrease[vid_scaled];"
            "[vid_scaled]pad=1080:1440:(ow-iw)/2:(oh-ih)/2:color=black[vid_padded];"
            "[0:v][vid_padded]overlay=0:240:eof_action=pass[out]",
            "-map", "[out]", "-map", "1:a?",
            "-t", str(REPLAY_S),
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
            "-c:a", "aac",
            str(tmp_dir / "output.mp4"),
        ]
        t0 = time.time()
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        elapsed = time.time() - t0
        out = tmp_dir / "output.mp4"
        assert proc.returncode == 0, f"sem shortest falhou: {proc.stderr[-300:]}"
        assert out.exists()
        log.info("  sem -shortest: %.2fs (OK)", elapsed)


# ── TESTE 8: eof_action=pass (versus eof_action=repeat) ─────────────────────

@register
def Teste8():
    """Comparar eof_action=pass vs eof_action=repeat.
    Repeat deve travar (timeout em 10s proposital)."""
    REPLAY_S = 3
    with tempfile.TemporaryDirectory(prefix="test_clip_") as tmp:
        tmp_dir = Path(tmp)
        video = _gen_test_video(tmp_dir / "input.mp4", 1280, 720, REPLAY_S)
        png = _gen_test_png(tmp_dir / "logo.png", 200, 160, "orange", "EOF")

        for eof, label in [("pass", "PASS"), ("repeat", "REPEAT")]:
            cmd = [
                "ffmpeg", "-y", "-nostdin",
                "-f", "lavfi", "-i",
                f"color=c=black:s=1080x1920:r=30:d={REPLAY_S}",
                "-sseof", f"-{REPLAY_S}",
                "-f", "concat", "-safe", "0",
                "-i", str(video),
                "-i", str(png),
                "-filter_complex",
                f"[1:v]scale=1080:1440:force_original_aspect_ratio=decrease[vid_scaled];"
                f"[vid_scaled]pad=1080:1440:(ow-iw)/2:(oh-ih)/2:color=black[vid_padded];"
                f"[0:v][vid_padded]overlay=0:240:eof_action=pass[base];"
                f"[base][2:v]scale=-1:160[sp];"
                f"[base][sp]overlay=(1080-iw)/2:(240-ih)/2:eof_action={eof}[out]",
                "-map", "[out]", "-map", "1:a?",
                "-t", str(REPLAY_S),
                "-shortest",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
                "-c:a", "aac",
                str(tmp_dir / f"{label.lower()}.mp4"),
            ]
            t0 = time.time()
            try:
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                elapsed = time.time() - t0
                label_str = f"eof_action={eof}: {elapsed:.2f}s (rc={proc.returncode})"
                if eof == "repeat":
                    log.warning("  REPEAT terminou em %.2fs (inesperado, mas OK)", elapsed)

                out_path = tmp_dir / f"{label.lower()}.mp4"
                if proc.returncode == 0 and out_path.exists():
                    d = _probe_duration(out_path)
                    log.info("  %s -> %s (duracao=%.2fs)", label_str, label, d)
                else:
                    log.info("  %s -> falha (rc=%d)", label_str, proc.returncode)
            except subprocess.TimeoutExpired:
                if eof == "repeat":
                    log.info("  eof_action=repeat: TIMEOUT (provavel causa raiz!)")
                else:
                    raise AssertionError(f"eof_action=pass tambem travou!")


# ── TESTE 9: FFmpeg loglevel debug-progress ────────────────────────────────

@register
def Teste9():
    """Executar FFmpeg com -loglevel debug e capturar frame progress."""
    REPLAY_S = 2
    with tempfile.TemporaryDirectory(prefix="test_clip_") as tmp:
        tmp_dir = Path(tmp)
        video = _gen_test_video(tmp_dir / "input.mp4", 640, 480, REPLAY_S)

        cmd = [
            "ffmpeg", "-y", "-nostdin",
            "-f", "lavfi", "-i",
            f"color=c=black:s=1080x1920:r=30:d={REPLAY_S}",
            "-sseof", f"-{REPLAY_S}",
            "-f", "concat", "-safe", "0",
            "-i", str(video),
            "-filter_complex",
            "[1:v]scale=1080:1440:force_original_aspect_ratio=decrease[vid_scaled];"
            "[vid_scaled]pad=1080:1440:(ow-iw)/2:(oh-ih)/2:color=black[vid_padded];"
            "[0:v][vid_padded]overlay=0:240:eof_action=pass[out]",
            "-map", "[out]", "-map", "1:a?",
            "-t", str(REPLAY_S),
            "-shortest",
            "-loglevel", "debug",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
            "-c:a", "aac",
            str(tmp_dir / "output.mp4"),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        out = tmp_dir / "output.mp4"

        # Salva log para analise
        log_path = tmp_dir / "ffmpeg_debug.log"
        log_path.write_text(proc.stderr or proc.stdout or "(empty)")
        log.info("  log debug salvo em %s (%d bytes)", log_path, log_path.stat().st_size)

        assert proc.returncode == 0, f"loglevel debug falhou: {proc.stderr[-500:]}"
        assert out.exists()

        # Conta frames processados no log
        frame_count = proc.stderr.count("frame=") if proc.stderr else 0
        log.info("  frames processados: ~%d (estimado)", frame_count)


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    if not _ffmpeg_available():
        log.error("ffmpeg/ffprobe nao encontrados no PATH. Instale antes de rodar os testes.")
        sys.exit(1)

    args = sys.argv[1:]
    tests_to_run = args if args else ALL_TESTS

    test_fns = {name: globals()[name] for name in ALL_TESTS}

    results = {}
    for name in tests_to_run:
        if name not in test_fns:
            log.warning("Teste '%s' nao encontrado. Disponiveis: %s", name, ", ".join(ALL_TESTS))
            continue
        results[name] = run_test(name, test_fns[name])

    log.info("")
    log.info("=" * 60)
    log.info("RESUMO DOS TESTES")
    log.info("=" * 60)
    passed = sum(1 for v in results.values() if v)
    failed = sum(1 for v in results.values() if not v)
    for name, ok in results.items():
        status = "PASS" if ok else "FAIL"
        log.info("  %s: %s", name, status)
    log.info("")
    log.info("Total: %d passed, %d failed, %d total", passed, failed, len(results))

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
