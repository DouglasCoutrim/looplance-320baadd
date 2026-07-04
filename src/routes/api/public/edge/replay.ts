// POST /api/public/edge/replay
// Registra replay finalizado (spec 6.3).
// Body: { quadra_id, r2_key, video_url, duration_sec, file_size_bytes }
import { createFileRoute } from "@tanstack/react-router";
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from "@/lib/edge-auth.server";

interface ReplayBody {
  quadra_id: string;
  r2_key: string;
  video_url: string;
  duration_sec: number;
  file_size_bytes: number;
}

export const Route = createFileRoute("/api/public/edge/replay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const device = await requireEdgeDevice(request);
          const rawBody = await request.text();
          await requireEdgeSignature(request, rawBody);
          const body = JSON.parse(rawBody) as Partial<ReplayBody>;

          for (const field of [
            "quadra_id",
            "r2_key",
            "video_url",
            "duration_sec",
            "file_size_bytes",
          ] as const) {
            if (body[field] === undefined || body[field] === null) {
              return Response.json(
                { error: `campo obrigatório ausente: ${field}` },
                { status: 400 },
              );
            }
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: quadra, error: quadraErr } = await supabaseAdmin
            .from("quadras")
            .select("id, arena_id")
            .eq("id", body.quadra_id!)
            .maybeSingle();

          if (quadraErr) throw new EdgeAuthError(`Erro lendo quadra: ${quadraErr.message}`, 500);
          if (!quadra) return Response.json({ error: "quadra_id não encontrada" }, { status: 404 });
          if (quadra.arena_id !== device.arena_id) {
            return Response.json(
              { error: "quadra não pertence à arena deste edge device" },
              { status: 403 },
            );
          }

          const { data: replay, error: insertErr } = await supabaseAdmin
            .from("replays")
            .insert({
              arena_id: quadra.arena_id,
              quadra_id: quadra.id,
              edge_device_id: device.id,
              video_url: body.video_url!,
              r2_key: body.r2_key!,
              duration_sec: body.duration_sec!,
              file_size_bytes: body.file_size_bytes!,
            })
            .select()
            .single();

          if (insertErr) throw new EdgeAuthError(`Erro inserindo replay: ${insertErr.message}`, 500);

          return Response.json({ replay }, { status: 201 });
        } catch (err) {
          if (err instanceof EdgeAuthError) {
            console.error("[edge/replay] rejeitado:", err.status, err.message);
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[edge/replay] erro interno:", err);
          const msg = err instanceof Error ? err.message : "internal_error";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
