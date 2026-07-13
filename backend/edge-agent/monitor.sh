#!/usr/bin/env bash
# © 2026 Looplance. All Rights Reserved.
# Developed & Patented by Douglas Coutrim Silva.
#
# Central de Comando Looplance — tmux dashboard com toilet + journalctl + htop
#
# Uso:
#   ./monitor.sh          # inicia ou reconecta
#   looplance-monitor     # atalho global (criado pelo install.sh)
#
# Layout:
#   ┌──────────────────┐
#   │   Looplance       │  <- toilet --gay (6 linhas)
#   ├────────┬─────────┤
#   │ journal│  htop    │
#   │  -f    │         │
#   └────────┴─────────┘

set -euo pipefail

SESSION_NAME="looplance-monitor"
SERVICE="looplance-edge"

# ── Reconnect se a sessão já existir ────────────────────────────────
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    exec tmux attach-session -t "$SESSION_NAME"
fi

# ── Verifica dependências ───────────────────────────────────────────
MISSING=""
for cmd in tmux toilet htop; do
    if ! command -v "$cmd" &>/dev/null; then
        MISSING="$MISSING $cmd"
    fi
done
if [ -n "$MISSING" ]; then
    echo "Ferramentas ausentes:$MISSING"
    echo "Instale com:  sudo apt update && sudo apt install tmux toilet htop -y"
    exit 1
fi

# ── Cria sessão tmux ────────────────────────────────────────────────
tmux new-session -d -s "$SESSION_NAME" \; \
    send-keys "toilet -f standard 'Looplance' --gay && echo && echo 'Developed & Patented by Douglas Coutrim Silva | All Rights Reserved'" Enter \; \
    rename-window "Central de Comando" \; \
    split-window -v \; \
    send-keys "journalctl -u $SERVICE -f -n 50" Enter \; \
    split-window -h \; \
    send-keys "htop" Enter \; \
    resize-pane -t 0 -y 8 \; \
    select-pane -t 0 \;

# ── Anexa ────────────────────────────────────────────────────────────
exec tmux attach-session -t "$SESSION_NAME"
