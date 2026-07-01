#!/usr/bin/env bash
# Instala o Looplance Edge Agent como serviço systemd que inicia sozinho
# no boot e se auto-recupera de qualquer crash (Restart=always).
#
# Uso:
#   sudo ./install.sh
#
# Pré-requisitos: Ubuntu 22.04+, ffmpeg instalado (apt install ffmpeg),
# python3.10+, e o arquivo /etc/looplance/edge.env já gerado (normalmente
# pelo script do endpoint GET /api/public/edge-setup/:id).

set -euo pipefail

APP_DIR="/opt/looplance-edge"
ENV_FILE="/etc/looplance/edge.env"
SERVICE_USER="looplance"

if [[ $EUID -ne 0 ]]; then
  echo "Rode como root (sudo ./install.sh)" >&2
  exit 1
fi

echo "==> instalando dependências de sistema"
apt-get update -y
apt-get install -y ffmpeg python3 python3-venv python3-pip

echo "==> criando usuário de serviço (sem login)"
id -u "$SERVICE_USER" &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
usermod -aG input,plugdev "$SERVICE_USER" || true   # acesso a /dev/input (botoeira USB)

echo "==> copiando aplicação para $APP_DIR"
mkdir -p "$APP_DIR"
cp -r ./*.py "$APP_DIR/"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR"

echo "==> criando virtualenv e instalando dependências python"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r requirements.txt
cp requirements.txt "$APP_DIR/requirements.txt"

echo "==> garantindo /etc/looplance/edge.env"
mkdir -p /etc/looplance
if [[ ! -f "$ENV_FILE" ]]; then
  cp .env.example "$ENV_FILE"
  echo "!! Edite $ENV_FILE com EDGE_DEVICE_ID / EDGE_TOKEN / credenciais antes de iniciar o serviço."
fi
chmod 600 "$ENV_FILE"
chown root:"$SERVICE_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

echo "==> preparando diretório de buffer em RAM (tmpfs)"
# /dev/shm já é tmpfs por padrão no Ubuntu; garantimos que a subpasta exista
# e aumentamos o tamanho do tmpfs se necessário (ajuste conforme nº de câmeras).
mkdir -p /dev/shm/looplance
chown "$SERVICE_USER":"$SERVICE_USER" /dev/shm/looplance
if ! grep -q looplance-shm /etc/fstab; then
  echo "tmpfs /dev/shm tmpfs defaults,size=2G 0 0" >> /etc/fstab
  echo "!! /etc/fstab atualizado para /dev/shm=2G. Ajuste 'size=' conforme o número/resolução das câmeras."
fi

echo "==> instalando serviço systemd"
cp systemd/looplance-edge.service /etc/systemd/system/looplance-edge.service
systemctl daemon-reload

echo "==> habilitando início automático no boot"
systemctl enable looplance-edge.service

echo "==> iniciando serviço agora"
systemctl restart looplance-edge.service

echo
echo "Instalação concluída."
echo "Verifique status com:  systemctl status looplance-edge"
echo "Logs em tempo real com: journalctl -u looplance-edge -f"
echo
echo "O serviço já está habilitado para iniciar sozinho após qualquer reboot"
echo "(systemctl enable) e se reinicia automaticamente em caso de falha"
echo "(Restart=always no unit file)."
