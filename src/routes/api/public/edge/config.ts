// GET /api/public/edge/config
// Bootstrap do Edge Agent: câmeras ativas, input_boards e botoeiras vinculadas
// ao device autenticado. Baseado em backend/server-routes/edge/config.ts.
import { createFileRoute } from "@tanstack/react-router";
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from "@/lib/edge-auth.server";

export const Route = createFileRoute("/api/public/edge/config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const device = await requireEdgeDevice(request);
          await requireEdgeSignature(request, ""); // GET não tem body

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const [{ data: cameras, error: camErr }, { data: boards, error: boardErr }] =
            await Promise.all([
              supabaseAdmin
                .from("cameras")
                .select("*")
                .eq("edge_device_id", device.id),
              supabaseAdmin
                .from("input_boards")
                .select("id, name, device_name, vendor_id, product_id")
                .eq("edge_device_id", device.id),
            ]);


          if (camErr) throw new EdgeAuthError(`Erro lendo cameras: ${camErr.message}`, 500);
          if (boardErr) throw new EdgeAuthError(`Erro lendo input_boards: ${boardErr.message}`, 500);

          const cameraIds = (cameras ?? []).map((c) => c.id);
          let botoeiras: unknown[] = [];
          if (cameraIds.length > 0) {
            const { data, error } = await supabaseAdmin
              .from("botoeiras")
              .select("id, camera_id, local_key, ip_local")
              .in("camera_id", cameraIds);
            if (error) throw new EdgeAuthError(`Erro lendo botoeiras: ${error.message}`, 500);
            botoeiras = data ?? [];
          }

          return Response.json({
            device: { id: device.id, arena_id: device.arena_id, name: device.name },
            cameras: (cameras ?? []).map((c) => ({ ...c, arena_id: device.arena_id })),
            input_boards: boards ?? [],
            botoeiras,
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
