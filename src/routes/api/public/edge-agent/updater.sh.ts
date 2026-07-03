import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/edge-agent/updater.sh
 *
 * Script executado periodicamente pelo systemd timer no edge.
 * Baixa o manifesto atual, compara com a versão instalada
 * e substitui apenas os arquivos que mudaram. Reinicia o
 * serviço looplance-edge se algo foi atualizado.
 */
export const Route = createFileRoute("/api/public/edge-agent/updater.sh")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const script = `#!/usr/bin/env bash
set -euo pipefail

API_BASE="${origin}"
APP_DIR="/opt/looplance-edge"
STATE_DIR="/var/lib/looplance"
VERSION_FILE="\$STATE_DIR/agent.version"
MANIFEST_FILE="\$STATE_DIR/agent.manifest.json"
LOG_TAG="looplance-updater"

mkdir -p "\$APP_DIR" "\$STATE_DIR"

log() { logger -t "\$LOG_TAG" "\$*"; echo "[\$LOG_TAG] \$*"; }

TMP_MANIFEST="\$(mktemp)"
trap 'rm -f "\$TMP_MANIFEST"' EXIT

if ! curl -fsSL "\$API_BASE/api/public/edge-agent/manifest" -o "\$TMP_MANIFEST"; then
  log "manifesto indisponível, mantendo versão atual"
  exit 0
fi

REMOTE_VERSION="\$(jq -r .version "\$TMP_MANIFEST")"
LOCAL_VERSION="\$(cat "\$VERSION_FILE" 2>/dev/null || echo none)"

if [ "\$REMOTE_VERSION" = "\$LOCAL_VERSION" ]; then
  exit 0
fi

log "atualizando agent: \$LOCAL_VERSION -> \$REMOTE_VERSION"

CHANGED=0
COUNT="\$(jq '.files | length' "\$TMP_MANIFEST")"
for i in \$(seq 0 \$((COUNT - 1))); do
  REL="\$(jq -r ".files[\$i].path" "\$TMP_MANIFEST")"
  SHA="\$(jq -r ".files[\$i].sha256" "\$TMP_MANIFEST")"
  DEST="\$APP_DIR/\$REL"
  CURRENT_SHA=""
  if [ -f "\$DEST" ]; then
    CURRENT_SHA="\$(sha256sum "\$DEST" | awk '{print \$1}')"
  fi
  if [ "\$CURRENT_SHA" = "\$SHA" ]; then
    continue
  fi
  mkdir -p "\$(dirname "\$DEST")"
  TMP_FILE="\$(mktemp)"
  if ! curl -fsSL --get "\$API_BASE/api/public/edge-agent/file" \\
      --data-urlencode "path=\$REL" -o "\$TMP_FILE"; then
    log "falha ao baixar \$REL, abortando update"
    rm -f "\$TMP_FILE"
    exit 1
  fi
  DOWNLOADED_SHA="\$(sha256sum "\$TMP_FILE" | awk '{print \$1}')"
  if [ "\$DOWNLOADED_SHA" != "\$SHA" ]; then
    log "sha256 divergente em \$REL, abortando"
    rm -f "\$TMP_FILE"
    exit 1
  fi
  mv "\$TMP_FILE" "\$DEST"
  chown looplance:looplance "\$DEST" 2>/dev/null || true
  CHANGED=1
  log "atualizado: \$REL"
done

# Requirements podem ter mudado
if [ -f "\$APP_DIR/requirements.txt" ] && [ -x "\$APP_DIR/venv/bin/pip" ]; then
  "\$APP_DIR/venv/bin/pip" install --quiet --upgrade -r "\$APP_DIR/requirements.txt" || \\
    log "aviso: pip install falhou"
fi

cp "\$TMP_MANIFEST" "\$MANIFEST_FILE"
echo "\$REMOTE_VERSION" > "\$VERSION_FILE"

# Reinstala o unit file se veio alterado
if [ -f "\$APP_DIR/systemd/looplance-edge.service" ]; then
  if ! cmp -s "\$APP_DIR/systemd/looplance-edge.service" /etc/systemd/system/looplance-edge.service 2>/dev/null; then
    cp "\$APP_DIR/systemd/looplance-edge.service" /etc/systemd/system/looplance-edge.service
    systemctl daemon-reload
    CHANGED=1
  fi
fi

if [ "\$CHANGED" = "1" ]; then
  log "reiniciando looplance-edge"
  systemctl restart looplance-edge.service || log "aviso: restart falhou"
fi

log "update concluído em \$REMOTE_VERSION"
`;
        return new Response(script, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
