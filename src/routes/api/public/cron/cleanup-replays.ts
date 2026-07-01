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

        // Pull all replays with their arena retention (if any).
        const { data: replays, error } = await supabaseAdmin
          .from("replays")
          .select("id, r2_key, created_at, arena_id, arena_settings:arena_settings!inner(replay_retention_days, auto_cleanup_enabled)")
          .not("r2_key", "is", null);

        // arena_settings inner-join above may exclude replays whose arena has no
        // settings row — retry with a plain query and merge fallback TTL.
        let rows = replays ?? [];
        if (error) {
          const fallback = await supabaseAdmin
            .from("replays")
            .select("id, r2_key, created_at, arena_id")
            .not("r2_key", "is", null);
          if (fallback.error) return new Response(fallback.error.message, { status: 500 });
          rows = (fallback.data ?? []).map((r) => ({ ...r, arena_settings: null })) as typeof rows;
        }

        const now = Date.now();
        const results = { scanned: rows.length, deleted: 0, skipped: 0, errors: [] as string[] };

        for (const row of rows) {
          const settings = (row as unknown as { arena_settings: { replay_retention_days: number; auto_cleanup_enabled: boolean } | null }).arena_settings;
          if (settings && settings.auto_cleanup_enabled === false) {
            results.skipped++;
            continue;
          }
          const ttlHours = settings?.replay_retention_days
            ? settings.replay_retention_days * 24
            : fallbackHours;
          const ageMs = now - new Date(row.created_at).getTime();
          if (ageMs < ttlHours * 3_600_000) {
            results.skipped++;
            continue;
          }

          try {
            const del = await deleteR2Object(row.r2_key as string);
            await supabaseAdmin.from("r2_deletion_logs").insert({
              r2_key: row.r2_key,
              replay_id: row.id,
              arena_id: row.arena_id,
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
