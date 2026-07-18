// © 2026 Looplance. All Rights Reserved.

// GET /api/public/live/youtube-callback
// Recebe o code do Google OAuth, troca por tokens e salva no banco.
// Query: code, state
// Redirect de volta para /admin/arenas?youtube=ok

import { createFileRoute } from "@tanstack/react-router";
import { decodeOAuthState, exchangeCodeForTokens } from "@/lib/youtube-api.server";
import type { YouTubeApiError } from "@/lib/youtube-api.server";

function getRedirectUri(request: Request): string {
  const envUri = process.env.YOUTUBE_REDIRECT_URI;
  if (envUri) return envUri;
  const url = new URL(request.url);
  return `${url.origin}/api/public/live/youtube-callback`;
}

export const Route = createFileRoute("/api/public/live/youtube-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          if (error) {
            console.error("[youtube-callback] Google retornou erro:", error);
            return Response.redirect("/admin/arenas?youtube=error", 302);
          }
          if (!code || !state) {
            return Response.redirect("/admin/arenas?youtube=invalid", 302);
          }

          const decoded = decodeOAuthState(state);
          if (!decoded) {
            return Response.redirect("/admin/arenas?youtube=invalid", 302);
          }
          const { arenaId, userId } = decoded;

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: roles } = await supabaseAdmin.rpc("has_role", {
            _user_id: userId, _arena_id: arenaId, _role: "arena_owner",
          });
          const { data: isSuper } = await supabaseAdmin.rpc("is_super_admin");
          if (!isSuper && !roles) {
            return Response.redirect("/admin/arenas?youtube=forbidden", 302);
          }

          const tokens = await exchangeCodeForTokens(code, getRedirectUri(request));

          const { data: existing } = await supabaseAdmin
            .from("arena_youtube_credentials")
            .select("refresh_token")
            .eq("arena_id", arenaId)
            .maybeSingle();

          const payload: Record<string, string | null> = {
            arena_id: arenaId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || existing?.refresh_token || null,
            token_expires_at: new Date(
              Date.now() + (tokens.expires_in - 60) * 1000,
            ).toISOString(),
          };

          if (!payload.refresh_token) {
            console.error("[youtube-callback] Sem refresh_token (novo nem existente)");
            return Response.redirect("/admin/arenas?youtube=save_error", 302);
          }

          const { error: upsertError } = await supabaseAdmin
            .from("arena_youtube_credentials")
            .upsert(payload, { onConflict: "arena_id" });

          if (upsertError) {
            console.error("[youtube-callback] Erro salvando credenciais:", upsertError);
            return Response.redirect("/admin/arenas?youtube=save_error", 302);
          }

          return Response.redirect("/admin/arenas?youtube=ok", 302);
        } catch (err) {
          console.error("[youtube-callback]", err);
          return Response.redirect("/admin/arenas?youtube=error", 302);
        }
      },
    },
  },
});
