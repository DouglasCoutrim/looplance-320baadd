#!/bin/bash

echo "=================================================="
echo "🚀 Instalador Automático Looplance - Edge Node"
echo "=================================================="
echo ""

# Pergunta o token logo de cara
read -p "Cole o Token do túnel da Cloudflare e aperte Enter: " CF_TOKEN

# Verifica se o técnico não deixou vazio
if [ -z "$CF_TOKEN" ]; then
    echo "❌ Erro: O Token não pode estar vazio. Rode o script novamente."
    exit 1
fi

echo ""
echo "Iniciando a instalação automática. Pode ir tomar um café! ☕"
echo "=================================================="

# Variáveis
USER_HOME=$(eval echo ~$USER)
MTX_DIR="$USER_HOME/mediamtx"
MTX_VERSION="1.8.0"

echo "1/5 Atualizando pacotes do sistema..."
sudo apt-get update -y && sudo apt-get upgrade -y > /dev/null 2>&1
sudo apt-get install -y wget curl tar nano > /dev/null 2>&1

echo "2/5 Baixando e instalando Servidor de Vídeo..."
mkdir -p $MTX_DIR
cd $MTX_DIR
wget -q "https://github.com/bluenviron/mediamtx/releases/download/v${MTX_VERSION}/mediamtx_v${MTX_VERSION}_linux_amd64.tar.gz" -O mediamtx.tar.gz
tar -zxvf mediamtx.tar.gz > /dev/null 2>&1
rm mediamtx.tar.gz

echo "3/5 Configurando rotas dinâmicas e API..."
cat <<EOF > $MTX_DIR/mediamtx.yml
###############################################
# Global settings -> Control API
api: yes
apiAddress: :9997

###############################################
# Global settings -> WebRTC & HLS
webrtc: yes
hls: yes
hlsVariant: lowLatency

###############################################
# Path settings
paths:
  all_others:
EOF

echo "4/5 Criando serviços em segundo plano..."
sudo bash -c "cat <<EOF > /etc/systemd/system/mediamtx.service
[Unit]
Description=MediaMTX Video Server - Looplance
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=$MTX_DIR/mediamtx
WorkingDirectory=$MTX_DIR
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable mediamtx > /dev/null 2>&1
sudo systemctl start mediamtx

echo "5/5 Instalando e Autenticando Cloudflare Tunnel..."
cd $USER_HOME
curl -sL --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb > /dev/null 2>&1
rm cloudflared.deb

sudo cloudflared service install $CF_TOKEN

echo ""
echo "=================================================="
echo "✅ EDGE NODE LOOPLANCE INSTALADO COM SUCESSO!"
echo "O servidor de vídeo e a conexão segura estão online."
echo "=================================================="