// POST /api/public/cron/cleanup-replays  (spec 6.6)
// Header: x-cron-secret.
// Lê arena_settings, expira replays além da retenção, apaga do R2 e
// registra em r2_deletion_logs antes de remover a linha em `replays`.
import { createFileRoute } from "@tanstack/react-router";
import { requireCronSecret, EdgeAuthError } from "@/lib/edge-auth.server";
import { deleteR2Object } from "@/lib/r2.server";

export const Route = createFileRoute("/api/public/cron/cleanup-replays")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireCronSecret(request);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: settings, error: settingsErr } = await supabaseAdmin
            .from("arena_settings")
            .select("arena_id, replay_retention_days, auto_cleanup_enabled")
            .eq("auto_cleanup_enabled", true);

          if (settingsErr) {
            throw new EdgeAuthError(`Erro lendo arena_settings: ${settingsErr.message}`, 500);
          }

          const fallbackTtlDays = Number(process.env.REPLAY_TTL_HOURS ?? "72") / 24;
          let deleted = 0;
          let failed = 0;

          for (const s of settings ?? []) {
            const retentionDays = s.replay_retention_days || fallbackTtlDays;
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - retentionDays);

            const { data: expired, error: expiredErr } = await supabaseAdmin
              .from("replays")
              .select("id, r2_key")
              .eq("arena_id", s.arena_id)
              .lt("created_at", cutoff.toISOString());

            if (expiredErr) {
              console.error("erro lendo replays expirados", s.arena_id, expiredErr);
              continue;
            }

            for (const replay of expired ?? []) {
              if (!replay.r2_key) continue;
              try {
                const res = await deleteR2Object(replay.r2_key);
                await supabaseAdmin.from("r2_deletion_logs").insert({
                  replay_id: replay.id,
                  r2_key: replay.r2_key,
                  status: res.ok ? "deleted" : `r2_error_${res.status}`,
                });
                if (res.ok) {
                  await supabaseAdmin.from("replays").delete().eq("id", replay.id);
                  deleted++;
                } else {
                  failed++;
                }
              } catch (err) {
                failed++;
                console.error("erro deletando replay", replay.id, err);
              }
            }
          }

          return Response.json({ ok: true, deleted, failed });
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
