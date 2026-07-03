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

# --- 1. Atualizar sistema ---
echo "[1/6] Atualizando pacotes do sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# --- 2. Dependências base ---
echo "[2/6] Instalando dependências base (ffmpeg, curl, jq, git)..."
apt-get install -y ffmpeg curl jq git ca-certificates gnupg lsb-release ufw

# --- 3. Docker ---
if ! command -v docker >/dev/null 2>&1; then
  echo "[3/6] Instalando Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "[3/6] Docker já instalado, pulando."
fi

# --- 4. Configuração ---
echo "[4/6] Gravando configuração em /etc/looplance/edge.env ..."
mkdir -p /etc/looplance /var/log/looplance /var/lib/looplance/replays
cat > /etc/looplance/edge.env <<EOF
DEVICE_ID=$DEVICE_ID
DEVICE_NAME=$DEVICE_NAME
EDGE_TOKEN=$EDGE_TOKEN
EDGE_SHARED_SECRET=$EDGE_SHARED_SECRET
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
LOOPLANCE_API=$LOOPLANCE_API
EOF
chmod 600 /etc/looplance/edge.env

# --- 5. Heartbeat (systemd) ---
echo "[5/6] Instalando serviço de heartbeat..."
cat > /usr/local/bin/looplance-heartbeat.sh <<'HEART'
#!/usr/bin/env bash
set -e
source /etc/looplance/edge.env
while true; do
  HOSTNAME_LOCAL="$(hostname)"
  IP_LOCAL="$(hostname -I | awk '{print $1}')"
  UPTIME_SEC="$(awk '{print int($1)}' /proc/uptime)"
  BODY=$(jq -cn \
    --arg h "$HOSTNAME_LOCAL" \
    --arg ip "$IP_LOCAL" \
    --arg v "edge-0.1.0" \
    --argjson u "$UPTIME_SEC" \
    '{hostname:$h, local_ip:$ip, edge_version:$v, uptime_seconds:$u}')
  TS="$(date +%s000)"
  SIG=$(printf '%s' "$TS.$BODY" | openssl dgst -sha256 -hmac "$EDGE_SHARED_SECRET" -hex | awk '{print $2}')
  curl -sS -X POST \
    -H "Authorization: Bearer $EDGE_TOKEN" \
    -H "X-Edge-Timestamp: $TS" \
    -H "X-Edge-Signature: $SIG" \
    -H "Content-Type: application/json" \
    "$LOOPLANCE_API/api/public/edge/heartbeat" \
    --data-raw "$BODY" \
    >> /var/log/looplance/heartbeat.log 2>&1 || true
  sleep 60
done
HEART

chmod +x /usr/local/bin/looplance-heartbeat.sh

cat > /etc/systemd/system/looplance-heartbeat.service <<EOF
[Unit]
Description=Looplance Edge Heartbeat
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/looplance/edge.env
ExecStart=/usr/local/bin/looplance-heartbeat.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now looplance-heartbeat.service

# --- 6. Firewall básico ---
echo "[6/6] Configurando firewall (SSH + RTMP)..."
ufw allow OpenSSH || true
ufw allow 1935/tcp || true
ufw allow 8554/tcp || true
yes | ufw enable || true

echo ""
echo "============================================="
echo "  ✅ Looplance Edge provisionado com sucesso!"
echo "  Device: $DEVICE_NAME"
echo "  Heartbeat: systemctl status looplance-heartbeat"
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
