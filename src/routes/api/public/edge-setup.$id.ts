import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/edge-setup/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const supabaseUrl = process.env.SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const idParam = params.id.trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam);
        const query = supabaseAdmin
          .from("edge_devices")
          .select("id, name, hostname, edge_token, install_passphrase");
        const { data: device, error } = await (isUuid
          ? query.eq("id", idParam)
          : query.eq("edge_token", idParam.toUpperCase())
        ).maybeSingle();

        if (error || !device) {
          return new Response("# Edge device not found\nexit 1\n", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }

        // Exige palavra-chave de instalação (enviada pelo installer interativo)
        const providedPassphrase = (request.headers.get("x-install-passphrase") || "").trim().toLowerCase();
        const expected = ((device as any).install_passphrase || "").trim().toLowerCase();
        if (!providedPassphrase || providedPassphrase !== expected) {
          return new Response(
            "# Palavra-chave de instalação ausente ou incorreta.\n" +
              "# Use: curl -fsSL " + new URL(request.url).origin + "/install | sudo bash\n" +
              "exit 1\n",
            {
              status: 401,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            },
          );
        }

        const origin = new URL(request.url).origin;
        const deviceName = (device.name || "looplance-edge").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
        const token = device.edge_token || "";

        const script = `#!/usr/bin/env bash
# =====================================================================
# Looplance Edge - Setup automático para Ubuntu Server
# Device: ${device.name}   (id: ${device.id})
# Gerado em: ${new Date().toISOString()}
# =====================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "[Looplance] Este script precisa ser executado como root. Use: sudo bash"
  exit 1
fi

DEVICE_ID="${device.id}"
DEVICE_NAME="${deviceName}"
EDGE_TOKEN="${token}"
EDGE_SHARED_SECRET="${process.env.EDGE_SHARED_SECRET || ""}"
SUPABASE_URL="${supabaseUrl}"
SUPABASE_ANON_KEY="${supabaseKey}"
LOOPLANCE_API="${origin}"
R2_ACCESS_KEY_ID="${process.env.R2_ACCESS_KEY_ID || ""}"
R2_SECRET_ACCESS_KEY="${process.env.R2_SECRET_ACCESS_KEY || ""}"
R2_ENDPOINT_URL="${process.env.R2_ENDPOINT_URL || ""}"
R2_BUCKET_NAME="${process.env.R2_BUCKET_NAME || "looplance-replays"}"
R2_PUBLIC_BASE_URL="${process.env.R2_PUBLIC_BASE_URL || "https://replays.looplance.app"}"
R2_LIVE_BUCKET_NAME="${process.env.R2_LIVE_BUCKET_NAME || "looplance-live"}"
R2_LIVE_PUBLIC_BASE_URL="${process.env.R2_LIVE_PUBLIC_BASE_URL || "https://download.looplance.app"}"

fail() { echo ""; echo "[Looplance] ❌ ERRO: $*"; exit 1; }

echo ""
echo "============================================="
echo "  LOOPLANCE EDGE - Provisionamento Iniciado"
echo "  Device: $DEVICE_NAME"
echo "============================================="
echo ""

# --- 1. Dependências ---
echo "[1/7] Instalando dependências de sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ffmpeg curl jq git ca-certificates python3 python3-venv python3-pip openssl ufw

# --- 2. Usuário e diretórios ---
echo "[2/7] Criando usuário e diretórios..."
id -u looplance &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin looplance
usermod -aG input,plugdev looplance || true
mkdir -p /etc/looplance /var/log/looplance /var/lib/looplance /opt/looplance-edge /dev/shm/looplance
chown -R looplance:looplance /opt/looplance-edge /dev/shm/looplance /var/lib/looplance

# --- 3. Arquivo de ambiente ---
echo "[3/7] Escrevendo /etc/looplance/edge.env ..."
cat > /etc/looplance/edge.env <<EOF
EDGE_DEVICE_ID=$DEVICE_ID
EDGE_TOKEN=$EDGE_TOKEN
EDGE_SHARED_SECRET=$EDGE_SHARED_SECRET
API_BASE_URL=$LOOPLANCE_API
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
RAM_BUFFER_DIR=/dev/shm/looplance
HEARTBEAT_INTERVAL_SECONDS=30
EDGE_VERSION=1.0.0
EOF
chmod 640 /etc/looplance/edge.env
chown root:looplance /etc/looplance/edge.env

# Mantém uma cópia acessível em /opt/looplance-edge/.env (mesmas credenciais)
cp /etc/looplance/edge.env /opt/looplance-edge/.env
chown looplance:looplance /opt/looplance-edge/.env
chmod 640 /opt/looplance-edge/.env

# --- 4. Bootstrap do código do agent (inline, sem depender do timer) ---
echo "[4/7] Baixando código do agent do backend..."
MANIFEST_URL="$LOOPLANCE_API/api/public/edge-agent/manifest"
FILE_URL="$LOOPLANCE_API/api/public/edge-agent/file"
STATE_DIR="/var/lib/looplance"
mkdir -p "$STATE_DIR"
MANIFEST_PATH="$STATE_DIR/agent.manifest.json"

if ! curl -fsSL "$MANIFEST_URL" -o "$MANIFEST_PATH"; then
  fail "Não foi possível baixar o manifesto do agent em $MANIFEST_URL"
fi

COUNT="$(jq '.files | length' "$MANIFEST_PATH")"
if [ -z "$COUNT" ] || [ "$COUNT" = "0" ] || [ "$COUNT" = "null" ]; then
  fail "Manifesto vazio ou inválido - backend não empacotou os arquivos do agent"
fi

echo "     -> $COUNT arquivos a instalar"
for i in $(seq 0 $((COUNT - 1))); do
  REL="$(jq -r ".files[$i].path" "$MANIFEST_PATH")"
  SHA="$(jq -r ".files[$i].sha256" "$MANIFEST_PATH")"
  DEST="/opt/looplance-edge/$REL"
  mkdir -p "$(dirname "$DEST")"
  TMP="$(mktemp)"
  if ! curl -fsSL --get "$FILE_URL" --data-urlencode "path=$REL" -o "$TMP"; then
    rm -f "$TMP"
    fail "Falha ao baixar $REL"
  fi
  GOT_SHA="$(sha256sum "$TMP" | awk '{print $1}')"
  if [ "$GOT_SHA" != "$SHA" ]; then
    rm -f "$TMP"
    fail "sha256 divergente em $REL (esperado $SHA, obtido $GOT_SHA)"
  fi
  mv "$TMP" "$DEST"
  chown looplance:looplance "$DEST"
  echo "     ✓ $REL"
done

REMOTE_VERSION="$(jq -r .version "$MANIFEST_PATH")"
echo "$REMOTE_VERSION" > "$STATE_DIR/agent.version"

# Verifica que os arquivos críticos foram escritos
[ -f /opt/looplance-edge/main.py ] || fail "main.py não foi criado após o download"
[ -f /opt/looplance-edge/requirements.txt ] || fail "requirements.txt não foi criado após o download"

# --- 5. Virtualenv + dependências Python ---
echo "[5/7] Instalando virtualenv Python e dependências..."
if [ ! -x /opt/looplance-edge/venv/bin/python ]; then
  python3 -m venv /opt/looplance-edge/venv
fi
/opt/looplance-edge/venv/bin/pip install --upgrade pip >/dev/null
/opt/looplance-edge/venv/bin/pip install -r /opt/looplance-edge/requirements.txt \
  || fail "pip install -r requirements.txt falhou"
chown -R looplance:looplance /opt/looplance-edge/venv

# --- 6. Auto-updater (mantém o agent sincronizado após o setup) ---
echo "[6/7] Instalando auto-updater..."
curl -fsSL "$LOOPLANCE_API/api/public/edge-agent/updater" -o /usr/local/bin/looplance-update.sh
chmod +x /usr/local/bin/looplance-update.sh

cat > /etc/systemd/system/looplance-updater.service <<'EOF'
[Unit]
Description=Looplance Edge Agent auto-updater
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/looplance-update.sh
EOF

cat > /etc/systemd/system/looplance-updater.timer <<'EOF'
[Unit]
Description=Roda o looplance-updater periodicamente

[Timer]
OnBootSec=30s
OnUnitActiveSec=5min
Unit=looplance-updater.service

[Install]
WantedBy=timers.target
EOF

# --- 7. Serviço principal (systemd) ---
echo "[7/7] Instalando e iniciando serviço looplance-edge..."
if [ -f /opt/looplance-edge/systemd/looplance-edge.service ]; then
  cp /opt/looplance-edge/systemd/looplance-edge.service /etc/systemd/system/looplance-edge.service
else
cat > /etc/systemd/system/looplance-edge.service <<'EOF'
[Unit]
Description=Looplance Edge Agent
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=looplance
Group=looplance
WorkingDirectory=/opt/looplance-edge
EnvironmentFile=/etc/looplance/edge.env
ExecStart=/opt/looplance-edge/venv/bin/python /opt/looplance-edge/main.py
Restart=always
RestartSec=5
Nice=-5
LimitNOFILE=65536
StandardOutput=journal
StandardError=journal
SyslogIdentifier=looplance-edge

[Install]
WantedBy=multi-user.target
EOF
fi

systemctl daemon-reload
systemctl enable --now looplance-updater.timer
systemctl enable looplance-edge.service
systemctl restart looplance-edge.service || fail "systemctl restart looplance-edge falhou - veja: journalctl -u looplance-edge -n 100"

ufw allow OpenSSH || true
yes | ufw enable || true

sleep 2
STATUS="$(systemctl is-active looplance-edge.service || echo inactive)"
echo ""
echo "============================================="
if [ "$STATUS" = "active" ]; then
  echo "  ✅ Looplance Edge provisionado com sucesso!"
else
  echo "  ⚠️  Serviço instalado mas status = $STATUS"
  echo "     Rode: journalctl -u looplance-edge -n 100"
fi
echo "  Device:      $DEVICE_NAME"
echo "  Versão:      $REMOTE_VERSION"
echo "  Agent:       systemctl status looplance-edge"
echo "  Updater:     systemctl list-timers looplance-updater.timer"
echo "  Auto-update a cada 5 minutos."
echo "============================================="
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
