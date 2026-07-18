// © 2026 Looplance. All Rights Reserved.
// Developed & Patented by Douglas Coutrim Silva.

// POST /api/public/live/start
// Inicia uma transmissão ao vivo pública no YouTube para uma arena.
// Body: { arena_id }
// Auth: Bearer <supabase_access_token> (usuário admin/owner da arena)

import { createFileRoute } from "@tanstack/react-router";
import { getYouTubeClientForArenaWithName } from "@/lib/youtube-api.server";
import type { YouTubeApiError } from "@/lib/youtube-api.server";

export const Route = createFileRoute("/api/public/live/start")({
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

          const arenaClient = await getYouTubeClientForArenaWithName(body.arena_id);
          if (!arenaClient) {
            return Response.json(
              { error: "Arena não possui credenciais YouTube configuradas. Configure em Admin > YouTube." },
              { status: 400 },
            );
          }

          const { client, arenaName } = arenaClient;

          const broadcast = await client.createBroadcast(arenaName);
          const stream = await client.createStream();
          await client.bindBroadcast(broadcast.id, stream.id);

          const { data: quadra } = await supabaseAdmin
            .from("cameras")
            .select("quadra_id, id")
            .eq("edge_device_id", (
              await supabaseAdmin
                .from("arenas")
                .select("edge_device_id")
                .eq("id", body.arena_id)
                .single()
            ).data?.edge_device_id ?? "")
            .limit(1)
            .maybeSingle();

          const { error: insertError } = await supabaseAdmin
            .from("live_broadcasts")
            .insert({
              arena_id: body.arena_id,
              quadra_id: quadra?.quadra_id ?? null,
              camera_id: quadra?.id ?? null,
              youtube_broadcast_id: broadcast.id,
              youtube_stream_id: stream.id,
              stream_key: stream.streamKey,
              privacy_status: "public",
              status: "created",
              actual_start_time: new Date().toISOString(),
            });

          if (insertError) {
            throw new Error(`Erro ao salvar broadcast: ${insertError.message}`);
          }

          await supabaseAdmin
            .from("arena_youtube_credentials")
            .update({
              access_token: (client as any).credentials?.accessToken ?? undefined,
              token_expires_at: (client as any).credentials?.tokenExpiresAt ?? undefined,
            })
            .eq("arena_id", body.arena_id);

          return Response.json({
            ok: true,
            broadcast_id: broadcast.id,
            stream_id: stream.id,
            stream_key: stream.streamKey,
            ingestion_address: stream.ingestionAddress,
            video_id: null,
            privacy: "public",
          });
        } catch (err: unknown) {
          const apiErr = err as YouTubeApiError;
          if (apiErr?.status) {
            return Response.json({ error: apiErr.message }, { status: apiErr.status });
          }
          console.error("[live/start]", err);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
