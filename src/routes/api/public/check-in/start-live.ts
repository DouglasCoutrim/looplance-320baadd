import { createFileRoute } from "@tanstack/react-router";
import { getYouTubeClientForArenaWithName } from "@/lib/youtube-api.server";
import type { YouTubeApiError } from "@/lib/youtube-api.server";

export const Route = createFileRoute("/api/public/check-in/start-live")({
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
            return Response.json({ error: "Token invalido" }, { status: 401 });
          }

          const userId = userData.user.id;

          // Busca check-in ativo do usuario
          const { data: checkin, error: checkinErr } = await supabaseAdmin
            .from("check_ins")
            .select("id, arena_id, quadra_id")
            .eq("user_id", userId)
            .eq("active", true)
            .maybeSingle();

          if (checkinErr || !checkin) {
            return Response.json({ error: "Nenhum check-in ativo. Faca check-in primeiro." }, { status: 400 });
          }

          // Verifica se ja existe live ativa para essa quadra
          const { data: existingLive, error: liveErr } = await supabaseAdmin
            .from("live_broadcasts")
            .select("id, status")
            .eq("quadra_id", checkin.quadra_id)
            .in("status", ["created", "testing", "active"])
            .limit(1)
            .maybeSingle();

          if (liveErr) {
            return Response.json({ error: "Erro ao verificar live existente" }, { status: 500 });
          }
          if (existingLive) {
            return Response.json({ error: "Ja existe uma live ativa nesta quadra" }, { status: 409 });
          }

          // Busca cameras da quadra (streaming)
          const { data: camera, error: camErr } = await supabaseAdmin
            .from("cameras")
            .select("id, edge_device_id, streaming_status")
            .eq("quadra_id", checkin.quadra_id)
            .eq("streaming_status", "streaming")
            .limit(1)
            .maybeSingle();

          if (camErr) {
            return Response.json({ error: "Erro ao buscar cameras" }, { status: 500 });
          }
          if (!camera) {
            return Response.json({ error: "Nenhuma camera disponivel para transmitir" }, { status: 400 });
          }

          // Busca credenciais YouTube e inicia broadcast
          const arenaClient = await getYouTubeClientForArenaWithName(checkin.arena_id);
          if (!arenaClient) {
            return Response.json(
              { error: "Arena nao possui credenciais YouTube configuradas" },
              { status: 400 },
            );
          }

          const { client, arenaName } = arenaClient;
          const broadcast = await client.createBroadcast(arenaName);
          const stream = await client.createStream();
          await client.bindBroadcast(broadcast.id, stream.id);

          const scheduledEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString();

          const { error: insertError } = await supabaseAdmin
            .from("live_broadcasts")
            .insert({
              arena_id: checkin.arena_id,
              quadra_id: checkin.quadra_id,
              camera_id: camera.id,
              youtube_broadcast_id: broadcast.id,
              youtube_stream_id: stream.id,
              stream_key: stream.streamKey,
              privacy_status: "public",
              status: "created",
              actual_start_time: new Date().toISOString(),
              scheduled_end_time: scheduledEnd,
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
            .eq("arena_id", checkin.arena_id);

          return Response.json({
            ok: true,
            broadcast_id: broadcast.id,
            stream_key: stream.streamKey,
            ingestion_address: stream.ingestionAddress,
            video_id: broadcast.id,
            scheduled_end: scheduledEnd,
          });
        } catch (err: unknown) {
          const apiErr = err as YouTubeApiError;
          if (apiErr?.status) {
            return Response.json({ error: apiErr.message }, { status: apiErr.status });
          }
          console.error("[check-in/start-live]", err);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
