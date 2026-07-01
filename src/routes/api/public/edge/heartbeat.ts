import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateEdge } from "@/lib/edge-auth.server";

const bodySchema = z.object({
  hostname: z.string().max(255).optional(),
  local_ip: z.string().max(64).optional(),
  edge_version: z.string().max(64).optional(),
  uptime_seconds: z.number().int().nonnegative().optional(),
});

export const Route = createFileRoute("/api/public/edge/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateEdge(request);
        if (!auth.ok) return new Response(auth.message, { status: auth.status });

        let parsed: z.infer<typeof bodySchema> = {};
        if (auth.rawBody) {
          try {
            parsed = bodySchema.parse(JSON.parse(auth.rawBody));
          } catch (err) {
            return new Response(`Invalid body: ${(err as Error).message}`, { status: 400 });
          }
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("edge_devices")
          .update({
            status: "online",
            last_seen: new Date().toISOString(),
            hostname: parsed.hostname ?? undefined,
            local_ip: parsed.local_ip ?? undefined,
            edge_version: parsed.edge_version ?? undefined,
            uptime_seconds: parsed.uptime_seconds ?? undefined,
          })
          .eq("id", auth.device.id);

        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true, ts: new Date().toISOString() });
      },
    },
  },
});
