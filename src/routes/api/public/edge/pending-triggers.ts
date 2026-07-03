// GET /api/public/edge/pending-triggers
// Retorna disparos manuais pendentes das câmeras deste edge device e marca
// como "consumed" atomicamente. Usado quando não há placa botoeira física.
import { createFileRoute } from "@tanstack/react-router";
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from "@/lib/edge-auth.server";

export const Route = createFileRoute("/api/public/edge/pending-triggers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const device = await requireEdgeDevice(request);
          await requireEdgeSignature(request, "");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Câmeras deste device
          const { data: cameras, error: camErr } = await supabaseAdmin
            .from("cameras")
            .select("id")
            .eq("edge_device_id", device.id);
          if (camErr) throw new EdgeAuthError(`Erro lendo cameras: ${camErr.message}`, 500);
          const cameraIds = (cameras ?? []).map((c) => c.id);
          if (cameraIds.length === 0) return Response.json({ triggers: [] });

          // Pega pendentes e marca consumed
          const { data: pending, error: selErr } = await supabaseAdmin
            .from("manual_replay_triggers")
            .select("id, camera_id, created_at")
            .in("camera_id", cameraIds)
            .eq("status", "pending")
            .order("created_at", { ascending: true })
            .limit(20);
          if (selErr) throw new EdgeAuthError(`Erro lendo triggers: ${selErr.message}`, 500);

          const ids = (pending ?? []).map((t) => t.id);
          if (ids.length > 0) {
            const { error: updErr } = await supabaseAdmin
              .from("manual_replay_triggers")
              .update({ status: "consumed", consumed_at: new Date().toISOString(), edge_device_id: device.id })
              .in("id", ids);
            if (updErr) throw new EdgeAuthError(`Erro consumindo triggers: ${updErr.message}`, 500);
          }

          return Response.json({ triggers: pending ?? [] });
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
