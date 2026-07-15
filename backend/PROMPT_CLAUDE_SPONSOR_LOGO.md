# Prompt para Claude — Corrigir overlays de patrocinadores no clipe FFmpeg

## Contexto

Temos um pipeline de geração de vídeo EM DOIS FORMATOS (retrato 9:16 1080x1920 para stories Reels/Shorts, e paisagem 16:9 1920x1080 para YouTube/feed) usando FFmpeg em Python (`clip_builder.py`). O código detecta a orientação da câmera e ajusta o canvas, as faixas de patrocinadores e o posicionamento dinamicamente.

O vídeo final é composto por:

1. **Canvas preto** (1080x1920 para 9:16 ou 1920x1080 para 16:9, 30fps, duração = replay_seconds) gerado via `color` filter
2. **Vídeo do replay** (concat de segmentos .ts) — escalado e padded para caber na área do vídeo, centralizado no canvas
3. **Logos de patrocinadores** (PNGs) — overlay em faixas no topo e rodapé
4. **Watermark opcional** (overlay_url por câmera)

## O problema

As logos dos patrocinadores (PNGs com 1 frame apenas) estão sendo descartadas pelo FFmpeg no overlay porque o stream de entrada da imagem termina após 1 frame.

## O que já tentamos

1. **`-loop 1` no input**: `ffmpeg -loop 1 -i logo.png` — conflita com o fluxo dinâmico do `-f concat` (buffer de segmentos)
2. **`eof_action=repeat` no overlay**: FFmpeg ignora porque o input da imagem já morreu antes do overlay
3. **`tpad=stop_mode=clone:stop=-1` no filter_complex**: Adicionamos `tpad` após o `scale` de cada logo, mas ainda não testamos se resolve

## Arquivo completo: `backend/edge-agent/clip_builder.py`

### Constantes do canvas (9:16 e 16:9)

O código detecta a orientação pela câmera e usa constantes diferentes:

**Modo 9:16 (retrato — Reels/Shorts):**
```python
CANVAS_W = 1080
CANVAS_H = 1920
VIDEO_AREA_W = 1080
VIDEO_AREA_H = 1440         # 1920 - 240 - 240
VIDEO_OFFSET_Y = 240        # banner superior em px
BANNER_H = 240              # altura de cada faixa (topo / rodape)
LOGO_MAX_H = 160            # altura maxima de cada logo
```

**Modo 16:9 (paisagem — YouTube/feed):**
- CANVAS_W = 1920, CANVAS_H = 1080
- As faixas de patrocinadores são laterais (esquerda/direita) em vez de topo/rodapé
- O overlay muda de `overlay=0:Y` para `overlay=X:0`
- As expressões de posicionamento Y usam `ih`/`h` (altura) no 9:16, e `iw`/`w` (largura) no 16:9

O filter complex é gerado dinamicamente dependendo do `camera.aspect` (9:16 ou 16:9).

### Ordem dos inputs FFmpeg

```python
# [0] canvas preto (color filter, duração = replay_seconds)
["-f", "lavfi", "-i", f"color=c=black:s={CANVAS_W}x{CANVAS_H}:r=30:d={replay_seconds}"]

# [1] vídeo do replay (concat de segmentos .ts)
["-f", "concat", "-safe", "0", "-i", str(concat_list)]

# [2..N] logos dos patrocinadores (PNG, 1 frame cada)
for sf in top_sponsors + bottom_sponsors:
    inputs += ["-i", sf["path"]]

# [N+1] overlay_url opcional
inputs += ["-i", overlay_url]
```

### Filter complex atual (exemplo 9:16)

```python
# 1) Escala e padding do vídeo
[1:v]scale=1080:1440:force_original_aspect_ratio=decrease[vid_scaled]
[vid_scaled]pad=1080:1440:(ow-iw)/2:(oh-ih)/2:color=black[vid_padded]

# 2) Overlay do vídeo sobre o canvas
[0:v][vid_padded]overlay=0:240:eof_action=pass[base]           # 9:16 Y=240
# No 16:9 seria: overlay=240:0:eof_action=pass[base]            # 16:9 X=240

# 3) Para cada logo do topo/rodapé (9:16) ou esquerda/direita (16:9):
# 9:16: topo (Y=0..240) e rodapé (Y=1680..1920)
# 16:9: esquerda (X=0..240) e direita (X=1680..1920)

# 9:16 — logos no topo:
[2:v]scale=-1:160:force_original_aspect_ratio=decrease,tpad=stop_mode=clone:stop=-1[sp_t0]
[base][sp_t0]overlay=(1080-iw)/2:(240-h)/2:eof_action=repeat[v_t0]

# 9:16 — logos no rodapé:
[3:v]scale=-1:160:force_original_aspect_ratio=decrease,tpad=stop_mode=clone:stop=-1[sp_b0]
[v_t0][sp_b0]overlay=(1080-iw)/2:(1920-240)+(240-h)/2:eof_action=repeat[v_b0]

# 16:9 — as expressões trocam eixos: X usa fórmulas do banner, Y centraliza no canvas
```

> Nota: `iw` no overlay refere-se à largura do MAIN input (o canvas/base), não do overlay. Isso é um bug conhecido — as expressões X/Y podem estar usando `iw`/`ih` incorretamente. O correto para centralizar o logo é usar `w`/`h` (dimensões do overlay) em vez de `iw`/`ih` (dimensões do main).

### Comando FFmpeg final

```bash
ffmpeg -y -nostdin \
  -f lavfi -i color=c=black:s=1080x1920:r=30:d=30 \
  -f concat -safe 0 -i /tmp/concat_list.txt \
  -i /opt/looplance-edge/sponsors/<arena_id>/slot_0.png \
  -i /opt/looplance-edge/sponsors/<arena_id>/slot_1.png \
  -filter_complex "<string acima>" \
  -map "[v_final]" \
  -map "1:a?" \
  -metadata title="Looplance Replay" \
  -c:v libx264 -preset ultrafast -crf 28 \
  -c:a aac -b:a 64k \
  -movflags +faststart \
  -pix_fmt yuv420p \
  -t 30 \
  output.mp4
```

## O que eu preciso

1. **Diagnóstico**: Por que o `tpad` atual (já implementado) pode não estar funcionando? O `tpad` precisa vir em um contexto diferente?

2. **Solução definitiva**: Gere o código Python completo e funcional para garantir que as logos apareçam durante TODO o vídeo. Considere estas abordagens (ou sugira outra melhor):

   a) **`tpad` por input label** — fazer o `tpad` funcionar corretamente no filter complex

   b) **`movie` filter** — usar `movie=logo.png:loop=0` dentro do filter complex em vez de input separado

   c) **`concat` com imagem estática** — usar `image2` ou `concat` para estender a imagem

   d) **Gerar vídeo a partir do PNG** — usar FFmpeg para converter PNG em vídeo curto (ex: `-loop 1 -t 30`) em um passo separado e usar esse vídeo como input

3. **Regras**:
   - O input `[0:v]` é o canvas preto (sempre presente)
   - O input `[1:v]` é o vídeo do replay (sempre presente)
   - Os inputs `[2:v]`, `[3:v]`, etc. são os logos (quantidade variável)
   - O último input é o overlay_url opcional
   - A duração total do vídeo é `replay_seconds` (tipicamente 30s)
   - O filtro `color` do canvas já tem `d={replay_seconds}`
   - O overlay do vídeo usa `eof_action=pass` (para quando o canvas acabar, o vídeo passa)
   - Performance é crítica (edge device rodando em servidor Ubuntu na arena)

4. **Código esperado**: Modificações específicas no `clip_builder.py`:
   - Função `_build_inputs()` — como passar as imagens
   - Função `_build_filter_complex()` — como referenciar os inputs no filter graph
   - Função `_append_logo_overlays()` — como escalar e fazer overlay com duração infinita

5. **Dois formatos**: A solução precisa funcionar tanto para 9:16 (1080x1920, banners topo/rodapé) quanto para 16:9 (1920x1080, banners esquerda/direita). O `camera.aspect` define o formato.

6. **Teste**: Gere comandos FFmpeg completos (hardcoded com valores reais) para AMBOS os formatos (9:16 e 16:9) que eu possa copiar e colar no terminal para testar isoladamente, sem depender do Python.

## Informações adicionais

- FFmpeg version: 7.1 (ou similar recente no Ubuntu 22.04/24.04)
- Sistema operacional: Ubuntu Server (edge device)
- Os PNGs dos patrocinadores estão em: `/opt/looplance-edge/sponsors/<arena_id>/slot_<position>.png`
- O vídeo de entrada é um concat de segmentos .ts de ~2s cada (buffer circular em RAM)
- Teste com: 1 logo topo + 1 logo rodapé (9:16) e 1 logo esquerda + 1 logo direita (16:9), 30s de duração
- Logs de erro: FFmpeg retorna código 234 quando algo inválido no filter complex
- Debug disponível: o stderr do FFmpeg é salvo em `/dev/shm/looplance/tmp/<clip_id>_ffmpeg_stderr.txt`
