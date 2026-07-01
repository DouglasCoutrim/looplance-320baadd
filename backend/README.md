# Looplance Edge — Backend entregue

Este pacote cobre exatamente o que faltava na spec (seções 6, 8 e o
comportamento de captura descrito na visão geral), assumindo que schema
Postgres, RLS base, buckets e Auth já estão em produção conforme o
documento.

## O que tem aqui

```
edge-agent/          → software que roda NO servidor Ubuntu da arena
  main.py             orquestrador (start/stop, health, heartbeat)
  ram_buffer.py        buffer circular EM RAM (tmpfs) por câmera via ffmpeg
  clip_builder.py       concat + trim + overlay do replay final
  trigger.py             escuta a botoeira física (evdev)
  uploader.py              upload do clip pro R2
  api_client.py               chama os endpoints /api/public/edge/*
  config.py                    lê /etc/looplance/edge.env + config remota
  systemd/looplance-edge.service   unit com Restart=always
  install.sh                        instala e habilita no boot (systemctl enable)

server-routes/        → endpoints TanStack Start (copiar para app/routes/api/public/)
  edge/config.ts        GET  bootstrap de câmeras/botoeiras pro agent
  edge/replay.ts         POST registra replay finalizado (spec 6.3)
  edge/camera-status.ts    POST status de streaming da câmera (spec 6.4)
  edge/heartbeat.ts          POST heartbeat roteado (alternativa ao PATCH direto)
  cron/cleanup-replays.ts     POST limpeza de replays expirados no R2 (spec 6.6)
  _lib/                         helpers server-only (service role, R2, auth)

sql/002_edge_agent_support.sql   RPCs opcionais + policy do heartbeat + realtime
```

## Por que "buffer em RAM" e não em disco

Cada câmera roda um processo `ffmpeg -f segment` gravando segmentos de
~2s direto em `/dev/shm/looplance/<camera_id>/` (tmpfs = RAM). O próprio
ffmpeg recicla os nomes de arquivo (`-segment_wrap`) assim que o buffer
atinge `buffer_seconds`, então:

- nenhum frame de vídeo é escrito em HD, só em memória;
- não existe acúmulo/nem necessidade de limpeza manual de arquivo antigo,
  o próprio ffmpeg sobrescreve;
- quando o botão é pressionado, os segmentos relevantes são concatenados
  e recortados (`clip_builder.py`) e o **arquivo final** também é escrito
  em tmpfs (`/dev/shm/looplance/tmp/`), enviado pro R2 e apagado logo em
  seguida — o disco físico nunca entra no caminho do vídeo.

Ajuste o tamanho do tmpfs em `/etc/fstab` (`install.sh` já sugere 2G;
aumente conforme número de câmeras × `buffer_seconds` × bitrate).

## Por que é autônomo após reboot

`install.sh` copia o agente para `/opt/looplance-edge`, instala o unit
`looplance-edge.service` e roda:

```bash
systemctl enable looplance-edge.service   # inicia sozinho em todo boot
systemctl restart looplance-edge.service  # sobe agora
```

O unit tem `Restart=always` — se o processo cair por qualquer motivo
(RTSP instável, oom, etc.) o systemd sobe de novo sozinho, sem
intervenção manual. Dentro do agente, `_health_loop` também reinicia
individualmente qualquer câmera cujo ffmpeg tenha morrido, sem precisar
reiniciar o serviço inteiro.

## Instalação no servidor da arena

```bash
# 1. Gerar o edge_device no admin -> baixar o script de GET /api/public/edge-setup/:id
#    (já existe, spec 6.1) e rodar -- ele grava /etc/looplance/edge.env
#    com EDGE_DEVICE_ID e EDGE_TOKEN corretos.

# 2. Copiar a pasta edge-agent/ pro servidor e instalar:
cd edge-agent
sudo ./install.sh

# 3. Conferir:
systemctl status looplance-edge
journalctl -u looplance-edge -f
```

## Autenticação dos Edges: token + assinatura HMAC

Cada device já tem seu `edge_token` próprio (`edge_devices.edge_token`,
enviado como `Authorization: Bearer`). Além disso, todo request de
`edge/config`, `edge/replay`, `edge/camera-status` e `edge/heartbeat`
(rota roteada) agora também carrega:

```
X-Edge-Timestamp: <unix ms>
X-Edge-Signature: hex( HMAC_SHA256(EDGE_SHARED_SECRET, `${timestamp}.${raw_body}`) )
```

`EDGE_SHARED_SECRET` é um segredo único, igual em todos os devices e no
servidor (diferente do `edge_token`, que é único por device). Isso é
defesa em profundidade: mesmo que um `edge_token` vaze sozinho (ex: log
mal configurado), quem pegar ele ainda não consegue forjar requisições
sem o `EDGE_SHARED_SECRET`. A janela de tolerância de relógio é 5 minutos
(protege contra replay de uma requisição capturada).

`config.py`/`api_client.py` do agent já geram esses headers
(`signed_headers`); `edgeAuth.server.ts` já valida (`requireEdgeSignature`).

**Exceção:** o heartbeat direto via `PATCH /rest/v1/edge_devices` (o
script bash antigo, mantido conforme spec 6.2) continua autenticado só
pelo `edge_token` no header `x-edge-token` + policy RLS — o PostgREST não
tem como verificar HMAC sem uma função `pgcrypto` a mais. Se quiserem essa
camada também aí, dá pra migrar esse heartbeat pra rota roteada
(`edge/heartbeat.ts`, que já tem `EDGE_SHARED_SECRET`) e desativar o PATCH
direto — é só trocar a chamada em `api_client.py::send_heartbeat` por
`_post_signed(settings, "/api/public/edge/heartbeat", body, timeout)`.

`crypto.subtle` (Web Crypto) é usado no lado servidor — funciona nativo em
Cloudflare Workers e em Node 19+. Se o alvo de deploy for Node mais
antigo, troque por `node:crypto` (`createHmac('sha256', ...)`).

## Instalação dos endpoints

Copie `server-routes/*` para dentro do seu app TanStack Start em
`app/routes/api/public/` (ajuste os caminhos relativos de import de
`_lib/` conforme a profundidade final das pastas). Copie `server-routes/.env.example` pro `.env` do app (nomes já alinhados
com o que vocês têm hoje: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`R2_*`, `EDGE_SHARED_SECRET`, `CRON_SECRET`, `REPLAY_TTL_HOURS`) e
instale as deps que faltam:

```bash
npm install @supabase/supabase-js @aws-sdk/client-s3
```

Depois rode `sql/002_edge_agent_support.sql` no seu banco (revise antes,
principalmente a policy de heartbeat, contra o que já existe hoje).

## Agendando o cron de limpeza

Como o stack não usa Supabase Edge Functions (spec, última linha), agende
via cron do host onde a API roda (ou Cloudflare Cron Trigger apontando
pro endpoint):

```
0 4 * * * curl -s -X POST https://looplance.app/api/public/cron/cleanup-replays \
  -H "x-cron-secret: $CRON_SECRET" >> /var/log/looplance-cleanup.log 2>&1
```

## O que ficou fora de propósito

- Filtro de RTSP por marca de câmera (Intelbras/Hikvision/etc.) — a spec
  já deixa isso como responsabilidade do frontend, que monta a
  `rtsp_url` final; o backend só consome a string.
- `vw_replays_daily` (view do dashboard) — não afeta buffer/autonomia,
  posso gerar à parte se quiser.
- Assinatura de upload R2 (item 6.7, opcional) — hoje o agent já tem as
  credenciais R2 diretamente; migrar pra signed URL é uma melhoria de
  segurança futura, não bloqueante.
