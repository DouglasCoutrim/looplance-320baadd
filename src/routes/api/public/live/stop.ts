// © 2026 Looplance. All Rights Reserved.
// Developed & Patented by Douglas Coutrim Silva.

// POST /api/public/live/stop
// Encerra a transmissão ao vivo ativa de uma arena no YouTube.
// Body: { arena_id }
// Auth: Bearer <supabase_access_token> (usuário admin/owner da arena)

import { createFileRoute } from "@tanstack/react-router";
import { getYouTubeClientForArenaWithName } from "@/lib/youtube-api.server";
import type { YouTubeApiError } from "@/lib/youtube-api.server";

export const Route = createFileRoute("/api/public/live/stop")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization") ?? "";
          const match = authHeader.match(/^Bearer\s+(.+)$/i);
          const token = match?.[1]?.trim();
          if (!token) {
            return Response.json({ error: "Authorization: Bearer <token> ausente" }, { status: 401 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
          if (userError || !userData.user) {
            return Response.json({ error: "Token de autenticação inválido" }, { status: 401 });
          }

          const rawBody = await request.text();
          const body = JSON.parse(rawBody || "{}") as { arena_id?: string };
          if (!body.arena_id) {
            return Response.json({ error: "arena_id é obrigatório" }, { status: 400 });
          }

          const userId = userData.user.id;

          const { data: roles, error: rolesError } = await supabaseAdmin.rpc(
            "has_role",
            { _user_id: userId, _arena_id: body.arena_id, _role: "arena_owner" },
          );

          const { data: isSuperAdmin } = await supabaseAdmin.rpc("is_super_admin");

          const canManage = isSuperAdmin || (roles === true);
          if (!canManage) {
            return Response.json({ error: "Sem permissão para gerenciar esta arena" }, { status: 403 });
          }

          const { data: broadcast, error: broadcastError } = await supabaseAdmin
            .from("live_broadcasts")
            .select("*")
            .eq("arena_id", body.arena_id)
            .in("status", ["created", "testing", "active"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (broadcastError) {
            return Response.json({ error: `Erro lendo broadcast: ${broadcastError.message}` }, { status: 500 });
          }

          if (!broadcast) {
            return Response.json({ error: "Nenhuma transmissão ativa encontrada para esta arena" }, { status: 404 });
          }

          const arenaClient = await getYouTubeClientForArenaWithName(body.arena_id);
          if (!arenaClient) {
            return Response.json({ error: "Credenciais YouTube não encontradas" }, { status: 400 });
          }

          const { client } = arenaClient;

          try {
            await client.transitionBroadcast(broadcast.youtube_broadcast_id, "complete");
          } catch (transitionErr: unknown) {
            const apiErr = transitionErr as YouTubeApiError;
            console.error("[live/stop] Erro na transição YouTube (ignorando):", apiErr?.message);
          }

          const { error: updateError } = await supabaseAdmin
            .from("live_broadcasts")
            .update({
              status: "completed",
              actual_end_time: new Date().toISOString(),
            })
            .eq("id", broadcast.id);

          if (updateError) {
            return Response.json({ error: `Erro ao atualizar broadcast: ${updateError.message}` }, { status: 500 });
          }

          return Response.json({
            ok: true,
            broadcast_id: broadcast.youtube_broadcast_id,
            status: "completed",
          });
        } catch (err: unknown) {
          const apiErr = err as YouTubeApiError;
          if (apiErr?.status) {
            return Response.json({ error: apiErr.message }, { status: apiErr.status });
          }
          console.error("[live/stop]", err);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
