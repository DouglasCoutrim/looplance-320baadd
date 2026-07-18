// © 2026 Looplance. All Rights Reserved.

// GET /api/public/live/youtube-connect
// Retorna a URL de autenticação OAuth do Google para o admin conectar
// o canal do YouTube à arena. O frontend redireciona o navegador para
// essa URL.
//
// Query: arena_id
// Auth:  Authorization: Bearer <supabase_access_token>

import { createFileRoute } from "@tanstack/react-router";
import { generateYouTubeOAuthUrl } from "@/lib/youtube-api.server";
import type { YouTubeApiError } from "@/lib/youtube-api.server";

function getRedirectUri(request: Request): string {
  const envUri = process.env.YOUTUBE_REDIRECT_URI;
  if (envUri) return envUri;
  const url = new URL(request.url);
  return `${url.origin}/api/public/live/youtube-callback`;
}

export const Route = createFileRoute("/api/public/live/youtube-connect")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization") ?? "";
          const match = authHeader.match(/^Bearer\s+(.+)$/i);
          const token = match?.[1]?.trim();
          if (!token) {
            return Response.json({ error: "Authorization: Bearer <token> ausente" }, { status: 401 });
          }

          const url = new URL(request.url);
          const arenaId = url.searchParams.get("arena_id");
          if (!arenaId) {
            return Response.json({ error: "arena_id é obrigatório" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
          if (userError || !userData.user) {
            return Response.json({ error: "Token inválido" }, { status: 401 });
          }
          const userId = userData.user.id;

          const { data: roles } = await supabaseAdmin.rpc("has_role", {
            _user_id: userId, _arena_id: arenaId, _role: "arena_owner",
          });
          const { data: isSuper } = await supabaseAdmin.rpc("is_super_admin");
          if (!isSuper && !roles) {
            return Response.json({ error: "Sem permissão" }, { status: 403 });
          }

          const oauthUrl = generateYouTubeOAuthUrl(getRedirectUri(request), arenaId, userId);
          return Response.json({ url: oauthUrl });
        } catch (err) {
          const apiErr = err as YouTubeApiError;
          console.error("[youtube-connect]", err);
          return Response.json(
            { error: apiErr?.message ?? "internal_error" },
            { status: apiErr?.status ?? 500 },
          );
        }
      },
    },
  },
});
