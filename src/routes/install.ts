import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Atalho curto para o instalador: `looplance.app/install`
 * Redireciona para /api/public/install que serve o script bash.
 */
export const Route = createFileRoute("/install")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        return new Response(null, {
          status: 302,
          headers: {
            Location: `${origin}/api/public/install`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
  beforeLoad: () => {
    // Fallback para navegação client-side no navegador (não via curl)
    throw redirect({ href: "/api/public/install" });
  },
});
