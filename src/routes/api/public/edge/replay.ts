import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateEdge } from "@/lib/edge-auth.server";

const bodySchema = z.object({
  quadra_id: z.string().uuid(),
  video_url: z.string().url(),
  r2_key: z.string().min(1).optional(),
  duration_sec: z.number().positive().optional(),
  file_size_bytes: z.number().int().nonnegative().optional(),
  arena_id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/public/edge/replay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateEdge(request);
        if (!auth.ok) return new Response(auth.message, { status: auth.status });

        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(JSON.parse(auth.rawBody));
        } catch (err) {
          return new Response(`Invalid body: ${(err as Error).message}`, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("replays")
          .insert({
            quadra_id: parsed.quadra_id,
            video_url: parsed.video_url,
            r2_key: parsed.r2_key ?? null,
            duration_sec: parsed.duration_sec ?? null,
            file_size_bytes: parsed.file_size_bytes ?? null,
            arena_id: parsed.arena_id ?? auth.device.arena_id,
            edge_device_id: auth.device.id,
          })
          .select("id, created_at")
          .single();

        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ id: data.id, created_at: data.created_at }, { status: 201 });
      },
    },
  },
});
