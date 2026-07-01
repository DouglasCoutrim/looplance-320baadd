import { createFileRoute } from "@tanstack/react-router";
import { verifyCronSecret } from "@/lib/edge-auth.server";
import { deleteR2Object } from "@/lib/r2.server";

const DEFAULT_TTL_HOURS = 72;

export const Route = createFileRoute("/api/public/cron/cleanup-replays")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const fallbackHours = Number(process.env.REPLAY_TTL_HOURS) || DEFAULT_TTL_HOURS;

        const { data: rows, error } = await supabaseAdmin
          .from("replays")
          .select("id, r2_key, created_at, arena_id")
          .not("r2_key", "is", null);
        if (error) return new Response(error.message, { status: 500 });

        // Fetch retention settings for the involved arenas in one shot.
        const arenaIds = Array.from(
          new Set((rows ?? []).map((r) => r.arena_id).filter((x): x is string => !!x))
        );
        const settingsMap = new Map<string, { days: number; enabled: boolean }>();
        if (arenaIds.length) {
          const { data: settings } = await supabaseAdmin
            .from("arena_settings")
            .select("arena_id, replay_retention_days, auto_cleanup_enabled")
            .in("arena_id", arenaIds);
          for (const s of settings ?? []) {
            settingsMap.set(s.arena_id, {
              days: s.replay_retention_days,
              enabled: s.auto_cleanup_enabled,
            });
          }
        }

        const now = Date.now();
        const results = { scanned: rows?.length ?? 0, deleted: 0, skipped: 0, errors: [] as string[] };

        for (const row of rows ?? []) {
          const settings = row.arena_id ? settingsMap.get(row.arena_id) : undefined;
          if (settings && settings.enabled === false) {
            results.skipped++;
            continue;
          }
          const ttlHours = settings?.days ? settings.days * 24 : fallbackHours;
          const ageMs = now - new Date(row.created_at).getTime();
          if (ageMs < ttlHours * 3_600_000) {
            results.skipped++;
            continue;
          }

          const r2Key = row.r2_key as string;
          try {
            const del = await deleteR2Object(r2Key);
            await supabaseAdmin.from("r2_deletion_logs").insert({
              r2_key: r2Key,
              status: del.ok ? "deleted" : `r2_error_${del.status}`,
            });
            if (del.ok) {
              await supabaseAdmin.from("replays").delete().eq("id", row.id);
              results.deleted++;
            } else {
              results.errors.push(`${row.id}: r2 ${del.status}`);
            }
          } catch (err) {
            results.errors.push(`${row.id}: ${(err as Error).message}`);
          }
        }

        return Response.json(results);
      },
    },
  },
});
