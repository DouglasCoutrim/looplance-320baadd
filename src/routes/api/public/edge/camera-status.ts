// © 2026 Looplance. All Rights Reserved.
// Developed & Patented by Douglas Coutrim Silva.

// POST /api/public/edge/camera-status  (spec 6.4)
// Body: { camera_id, streaming_status, streaming_error? }
import { createFileRoute } from "@tanstack/react-router";
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from "@/lib/edge-auth.server";

const VALID_STATUSES = new Set(["online", "offline", "error", "starting"]);

export const Route = createFileRoute("/api/public/edge/camera-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const device = await requireEdgeDevice(request);
          const rawBody = await request.text();
          await requireEdgeSignature(request, rawBody);
          const body = JSON.parse(rawBody) as {
            camera_id?: string;
            streaming_status?: string;
            streaming_error?: string | null;
          };

          if (!body.camera_id || !body.streaming_status) {
            return Response.json(
              { error: "campos obrigatÃ³rios: camera_id, streaming_status" },
              { status: 400 },
            );
          }
          if (!VALID_STATUSES.has(body.streaming_status)) {
            return Response.json({ error: "streaming_status invÃ¡lido" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: camera, error: camErr } = await supabaseAdmin
            .from("cameras")
            .select("id, edge_device_id")
            .eq("id", body.camera_id)
            .maybeSingle();

          if (camErr) throw new EdgeAuthError(`Erro lendo camera: ${camErr.message}`, 500);
          if (!camera) return Response.json({ error: "camera_id nÃ£o encontrada" }, { status: 404 });
          if (camera.edge_device_id !== device.id) {
            return Response.json(
              { error: "cÃ¢mera nÃ£o pertence a este edge device" },
              { status: 403 },
            );
          }

          const { error: updateErr } = await supabaseAdmin
            .from("cameras")
            .update({
              streaming_status: body.streaming_status,
              streaming_error: body.streaming_error ?? null,
            })
            .eq("id", body.camera_id);

          if (updateErr) throw new EdgeAuthError(`Erro atualizando camera: ${updateErr.message}`, 500);

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
