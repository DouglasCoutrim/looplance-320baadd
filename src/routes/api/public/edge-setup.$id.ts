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

echo ""
echo "============================================="
echo "  LOOPLANCE EDGE - Provisionamento Iniciado"
echo "  Device: $DEVICE_NAME"
echo "============================================="
echo ""
# --- 1. Atualizar sistema e dependências ---
echo "[1/6] Atualizando pacotes e instalando dependências..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ffmpeg curl jq git ca-certificates python3 python3-venv python3-pip openssl ufw

# --- 2. Usuário e diretórios ---
echo "[2/6] Preparando usuário e diretórios..."
id -u looplance &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin looplance
usermod -aG input,plugdev looplance || true
mkdir -p /etc/looplance /var/log/looplance /var/lib/looplance /opt/looplance-edge /dev/shm/looplance
chown -R looplance:looplance /opt/looplance-edge /dev/shm/looplance /var/lib/looplance

# --- 3. Configuração ---
echo "[3/6] Gravando /etc/looplance/edge.env ..."
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

# --- 4. Virtualenv Python ---
echo "[4/6] Criando virtualenv do agent..."
if [ ! -x /opt/looplance-edge/venv/bin/python ]; then
  python3 -m venv /opt/looplance-edge/venv
  /opt/looplance-edge/venv/bin/pip install --upgrade pip
fi
chown -R looplance:looplance /opt/looplance-edge/venv

# --- 5. Auto-updater (mantém o agent sempre sincronizado com o backend) ---
echo "[5/6] Instalando auto-updater..."
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

cat > /etc/systemd/system/looplance-edge.service <<'EOF'
[Unit]
Description=Looplance Edge Agent
After=network-online.target looplance-updater.service
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

systemctl daemon-reload

# Executa o updater imediatamente para baixar o agent pela primeira vez.
echo "[6/6] Baixando código do agent via updater..."
/usr/local/bin/looplance-update.sh || true

systemctl enable --now looplance-updater.timer
systemctl enable looplance-edge.service
systemctl restart looplance-edge.service || true

ufw allow OpenSSH || true
yes | ufw enable || true

echo ""
echo "============================================="
echo "  ✅ Looplance Edge provisionado com sucesso!"
echo "  Device: $DEVICE_NAME"
echo "  Agent:     systemctl status looplance-edge"
echo "  Updater:   systemctl list-timers looplance-updater.timer"
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
