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

          // 1. Busca câmeras e input_boards em paralelo
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

          // 2. Resolve arena_id: device → quadra das câmeras
          const quadraIds = Array.from(
            new Set((cameras ?? []).map((c) => c.quadra_id).filter(Boolean) as string[]),
          );
          let resolvedArenaId = device.arena_id;
          const arenaByQuadra = new Map<string, string>();
          if (!resolvedArenaId && quadraIds.length > 0) {
            const { data: quadras, error: qErr } = await supabaseAdmin
              .from("quadras")
              .select("id, arena_id")
              .in("id", quadraIds);
            if (qErr) throw new EdgeAuthError(`Erro lendo quadras: ${qErr.message}`, 500);
            for (const q of quadras ?? []) {
              if (q.arena_id) {
                arenaByQuadra.set(q.id, q.arena_id);
                if (!resolvedArenaId) resolvedArenaId = q.arena_id;
              }
            }
          }

          // 3. Busca patrocinadores com o arena_id resolvido
          const { data: sponsors, error: spoErr } = resolvedArenaId
            ? await supabaseAdmin
                .from("arena_sponsors")
                .select("logo_url, position_index")
                .eq("arena_id", resolvedArenaId)
                .eq("is_active", true)
                .order("position_index", { ascending: true })
            : { data: [], error: null };

          if (spoErr) throw new EdgeAuthError(`Erro lendo arena_sponsors: ${spoErr.message}`, 500);

          // 4. Botoeiras
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
            device: { id: device.id, arena_id: resolvedArenaId, name: device.name },
            cameras: (cameras ?? []).map((c) => ({
              ...c,
              arena_id:
                resolvedArenaId ?? (c.quadra_id ? arenaByQuadra.get(c.quadra_id) ?? null : null),
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
