import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateEdge } from "@/lib/edge-auth.server";

const bodySchema = z.object({
  camera_id: z.string().uuid(),
  streaming_status: z.enum(["online", "offline", "error", "starting", "stopped"]),
  streaming_error: z.string().max(1000).nullable().optional(),
});

export const Route = createFileRoute("/api/public/edge/camera-status")({
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
        const { error } = await supabaseAdmin
          .from("cameras")
          .update({
            streaming_status: parsed.streaming_status,
            streaming_error: parsed.streaming_error ?? null,
          })
          .eq("id", parsed.camera_id)
          .eq("edge_device_id", auth.device.id);

        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
