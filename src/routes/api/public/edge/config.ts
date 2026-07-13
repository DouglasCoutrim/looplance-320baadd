// © 2026 Looplance. All Rights Reserved.
// Developed & Patented by Douglas Coutrim Silva.

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

          const arenaId = device.arena_id;

          const [{ data: cameras, error: camErr }, { data: boards, error: boardErr }, { data: sponsors, error: spoErr }] =
            await Promise.all([
              supabaseAdmin
                .from("cameras")
                .select("*")
                .eq("edge_device_id", device.id),
              supabaseAdmin
                .from("input_boards")
                .select("id, name, device_name, vendor_id, product_id")
                .eq("edge_device_id", device.id),
              arenaId
                ? supabaseAdmin
                    .from("arena_sponsors")
                    .select("logo_url, position_index")
                    .eq("arena_id", arenaId)
                    .eq("is_active", true)
                    .order("position_index", { ascending: true })
                : Promise.resolve({ data: [] }),
            ]);


          if (camErr) throw new EdgeAuthError(`Erro lendo cameras: ${camErr.message}`, 500);
          if (boardErr) throw new EdgeAuthError(`Erro lendo input_boards: ${boardErr.message}`, 500);
          if (spoErr) throw new EdgeAuthError(`Erro lendo arena_sponsors: ${spoErr.message}`, 500);

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

          // Resolve arena_id por câmera via quadra (fallback quando o edge
          // device não tem arena_id gravado). Isso garante que o LiveStreamer
          // gere a key correta em live/{arena_id}/{quadra_id}/...
          const quadraIds = Array.from(
            new Set((cameras ?? []).map((c) => c.quadra_id).filter(Boolean) as string[]),
          );
          const arenaByQuadra = new Map<string, string>();
          if (quadraIds.length > 0) {
            const { data: quadras, error: qErr } = await supabaseAdmin
              .from("quadras")
              .select("id, arena_id")
              .in("id", quadraIds);
            if (qErr) throw new EdgeAuthError(`Erro lendo quadras: ${qErr.message}`, 500);
            (quadras ?? []).forEach((q) => {
              if (q.arena_id) arenaByQuadra.set(q.id, q.arena_id);
            });
          }

          return Response.json({
            device: { id: device.id, arena_id: device.arena_id, name: device.name },
            cameras: (cameras ?? []).map((c) => ({
              ...c,
              arena_id:
                device.arena_id ?? (c.quadra_id ? arenaByQuadra.get(c.quadra_id) ?? null : null),
            })),
            input_boards: boards ?? [],
            botoeiras,
            sponsors: sponsors ?? [],
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
