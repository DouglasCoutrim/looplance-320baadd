import { createFileRoute } from "@tanstack/react-router";

/**
 * Installer interativo para servidores de borda (edge devices).
 *
 * Uso no servidor Ubuntu:
 *   curl -fsSL https://looplance.app/install | sudo bash
 *
 * O script pergunta interativamente (via /dev/tty, pois stdin está ocupado
 * pelo pipe do curl) o Token do device e a palavra-chave de instalação,
 * valida ambos contra `/api/public/edge-setup/{token}` (que exige o header
 * X-Install-Passphrase) e então executa o script real de provisionamento.
 */
export const Route = createFileRoute("/api/public/install")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;

        const script = `#!/usr/bin/env bash
# =====================================================================
# Looplance Edge - Instalador interativo
# =====================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "[Looplance] Execute como root: curl -fsSL ${origin}/install | sudo bash"
  exit 1
fi

# Precisamos ler do terminal (stdin está sendo consumido pelo pipe do curl)
if [ ! -t 0 ] && [ ! -r /dev/tty ]; then
  echo "[Looplance] Sem terminal interativo disponível. Rode diretamente no console do servidor."
  exit 1
fi

API_BASE="${origin}"

echo ""
echo "============================================="
echo "  LOOPLANCE EDGE - Instalação"
echo "============================================="
echo ""
echo "Informe os dados exibidos no painel Admin > Edge Devices."
echo ""

# --- Coletar dados ---
printf "Token do Edge Device (UUID): "
read -r EDGE_ID </dev/tty
printf "Palavra-chave de instalação: "
read -r INSTALL_PASS </dev/tty

if [ -z "$EDGE_ID" ] || [ -z "$INSTALL_PASS" ]; then
  echo "[Looplance] Token e palavra-chave são obrigatórios. Abortando."
  exit 1
fi

echo ""
echo "[Looplance] Validando credenciais..."

# --- Buscar o script real de provisionamento ---
TMP_SCRIPT="$(mktemp /tmp/looplance-setup.XXXXXX.sh)"
trap 'rm -f "$TMP_SCRIPT"' EXIT

HTTP_CODE=$(curl -sS -o "$TMP_SCRIPT" -w "%{http_code}" \
  -H "X-Install-Passphrase: $INSTALL_PASS" \
  "$API_BASE/api/public/edge-setup/$EDGE_ID" || echo "000")

case "$HTTP_CODE" in
  200)
    echo "[Looplance] Credenciais válidas. Iniciando provisionamento..."
    echo ""
    bash "$TMP_SCRIPT"
    ;;
  401|403)
    echo "[Looplance] ❌ Palavra-chave incorreta para este device. Abortando."
    exit 1
    ;;
  404)
    echo "[Looplance] ❌ Edge device não encontrado. Confira o token no painel."
    exit 1
    ;;
  *)
    echo "[Looplance] ❌ Erro inesperado (HTTP $HTTP_CODE). Tente novamente."
    exit 1
    ;;
esac
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
