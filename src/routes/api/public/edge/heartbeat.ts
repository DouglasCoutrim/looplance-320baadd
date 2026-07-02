// POST /api/public/edge/heartbeat  (spec 6.2 — rota roteada, alternativa ao PATCH direto).
import { createFileRoute } from "@tanstack/react-router";
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from "@/lib/edge-auth.server";

export const Route = createFileRoute("/api/public/edge/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const device = await requireEdgeDevice(request);
          const rawBody = await request.text();
          await requireEdgeSignature(request, rawBody);
          const body = JSON.parse(rawBody || "{}") as {
            hostname?: string;
            local_ip?: string;
            uptime_seconds?: number;
            edge_version?: string;
            cpu_percent?: number;
            memory_percent?: number;
            memory_total_mb?: number;
            memory_used_mb?: number;
            disk_percent?: number;
            temperature_c?: number;
            net_rx_bps?: number;
            net_tx_bps?: number;
            load_avg_1m?: number;
          };

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("edge_devices")
            .update({
              status: "online",
              last_seen: new Date().toISOString(),
              hostname: body.hostname ?? undefined,
              local_ip: body.local_ip ?? undefined,
              uptime_seconds: body.uptime_seconds ?? undefined,
              edge_version: body.edge_version ?? undefined,
              cpu_percent: body.cpu_percent ?? undefined,
              memory_percent: body.memory_percent ?? undefined,
              memory_total_mb: body.memory_total_mb ?? undefined,
              memory_used_mb: body.memory_used_mb ?? undefined,
              disk_percent: body.disk_percent ?? undefined,
              temperature_c: body.temperature_c ?? undefined,
              net_rx_bps: body.net_rx_bps ?? undefined,
              net_tx_bps: body.net_tx_bps ?? undefined,
              load_avg_1m: body.load_avg_1m ?? undefined,
            })
            .eq("id", device.id);


          if (error) throw new EdgeAuthError(`Erro atualizando heartbeat: ${error.message}`, 500);
          return Response.json({ ok: true });
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
