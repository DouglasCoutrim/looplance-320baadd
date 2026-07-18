// © 2026 Looplance. All Rights Reserved.

// POST /api/public/live/youtube-disconnect
// Remove as credenciais YouTube de uma arena.
// Body: { arena_id }
// Auth: Bearer <supabase_access_token>

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/live/youtube-disconnect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization") ?? "";
          const match = authHeader.match(/^Bearer\s+(.+)$/i);
          const token = match?.[1]?.trim();
          if (!token) {
            return Response.json({ error: "Authorization ausente" }, { status: 401 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
          if (userError || !userData.user) {
            return Response.json({ error: "Token inválido" }, { status: 401 });
          }

          const rawBody = await request.text();
          const body = JSON.parse(rawBody || "{}") as { arena_id?: string };
          if (!body.arena_id) {
            return Response.json({ error: "arena_id é obrigatório" }, { status: 400 });
          }

          const userId = userData.user.id;
          const { data: roles } = await supabaseAdmin.rpc("has_role", {
            _user_id: userId, _arena_id: body.arena_id, _role: "arena_owner",
          });
          const { data: isSuper } = await supabaseAdmin.rpc("is_super_admin");
          if (!isSuper && !roles) {
            return Response.json({ error: "Sem permissão" }, { status: 403 });
          }

          const { error: deleteError } = await supabaseAdmin
            .from("arena_youtube_credentials")
            .delete()
            .eq("arena_id", body.arena_id);

          if (deleteError) {
            return Response.json({ error: deleteError.message }, { status: 500 });
          }

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[youtube-disconnect]", err);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
