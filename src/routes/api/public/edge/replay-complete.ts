// PATCH /api/public/edge/replay-complete
// Atualiza replay de 'processing' para 'ready' após upload bem-sucedido.
import { createFileRoute } from "@tanstack/react-router";
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from "@/lib/edge-auth.server";

interface ReplayCompleteBody {
  replay_id: string;
  status: string;
  r2_key: string;
  video_url: string;
  duration_sec: number;
  file_size_bytes: number;
}

export const Route = createFileRoute("/api/public/edge/replay-complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const device = await requireEdgeDevice(request);
          const rawBody = await request.text();
          await requireEdgeSignature(request, rawBody);
          const body = JSON.parse(rawBody) as Partial<ReplayCompleteBody>;

          if (!body.replay_id || !body.status) {
            return Response.json(
              { error: "campos obrigatórios ausentes: replay_id, status" },
              { status: 400 },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const updateData: Record<string, unknown> = {
            status: body.status,
          };
          if (body.r2_key) updateData.r2_key = body.r2_key;
          if (body.video_url) updateData.video_url = body.video_url;
          if (body.duration_sec) updateData.duration_sec = body.duration_sec;
          if (body.file_size_bytes) updateData.file_size_bytes = body.file_size_bytes;

          const { error } = await supabaseAdmin
            .from("replays")
            .update(updateData)
            .eq("id", body.replay_id)
            .eq("edge_device_id", device.id);

          if (error) throw new EdgeAuthError(`Erro atualizando replay: ${error.message}`, 500);

          return Response.json({ ok: true }, { status: 200 });
        } catch (err) {
          if (err instanceof EdgeAuthError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[edge/replay-complete] erro interno:", err);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
