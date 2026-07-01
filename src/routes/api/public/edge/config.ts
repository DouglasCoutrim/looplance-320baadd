import { createFileRoute } from "@tanstack/react-router";
import { authenticateEdge } from "@/lib/edge-auth.server";

export const Route = createFileRoute("/api/public/edge/config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateEdge(request);
        if (!auth.ok) return new Response(auth.message, { status: auth.status });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const [{ data: cameras }, { data: inputBoards }] = await Promise.all([
          supabaseAdmin
            .from("cameras")
            .select("*")
            .eq("edge_device_id", auth.device.id)
            .eq("active", true),
          supabaseAdmin
            .from("input_boards")
            .select("*")
            .eq("edge_device_id", auth.device.id),
        ]);

        const cameraIds = (cameras || []).map((c) => c.id);
        const { data: botoeiras } = cameraIds.length
          ? await supabaseAdmin.from("botoeiras").select("*").in("camera_id", cameraIds)
          : { data: [] as unknown[] };

        return Response.json({
          device: {
            id: auth.device.id,
            name: auth.device.name,
            arena_id: auth.device.arena_id,
          },
          cameras: cameras || [],
          input_boards: inputBoards || [],
          botoeiras: botoeiras || [],
        });
      },
    },
  },
});
