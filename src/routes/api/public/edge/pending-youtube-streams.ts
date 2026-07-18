// © 2026 Looplance. All Rights Reserved.
// Developed & Patented by Douglas Coutrim Silva.

// GET /api/public/edge/pending-youtube-streams
// Retorna transmissões ao vivo no YouTube com status 'created' ou 'active'
// para o edge device autenticado. O Edge Agent usa isso para saber
// se deve redirecionar o RTMP da câmera para o YouTube.
//
// Auth: edge_token (Bearer) + HMAC signature

import { createFileRoute } from "@tanstack/react-router";
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from "@/lib/edge-auth.server";

export const Route = createFileRoute("/api/public/edge/pending-youtube-streams")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const device = await requireEdgeDevice(request);
          const rawBody = "";
          await requireEdgeSignature(request, rawBody);

          if (!device.arena_id) {
            return Response.json({ streams: [] });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: broadcasts, error } = await supabaseAdmin
            .from("live_broadcasts")
            .select("id, youtube_broadcast_id, stream_key, camera_id, status, privacy_status")
            .eq("arena_id", device.arena_id)
            .in("status", ["created", "testing", "active"])
            .order("created_at", { ascending: false })
            .limit(5);

          if (error) {
            throw new EdgeAuthError(`Erro lendo broadcasts: ${error.message}`, 500);
          }

          return Response.json({
            streams: (broadcasts ?? []).map((b) => ({
              id: b.id,
              youtube_broadcast_id: b.youtube_broadcast_id,
              stream_key: b.stream_key,
              camera_id: b.camera_id,
              status: b.status,
              privacy_status: b.privacy_status,
            })),
          });
        } catch (err) {
          if (err instanceof EdgeAuthError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error(err);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
