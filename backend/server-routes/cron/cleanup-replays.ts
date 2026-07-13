// © 2026 Looplance. All Rights Reserved.
// Developed & Patented by Douglas Coutrim Silva.

// app/routes/api/public/cron/cleanup-replays.ts
//
// POST /api/public/cron/cleanup-replays   (spec 6.6)
// Header: x-cron-secret (comparação timing-safe contra CRON_SECRET)
//
// Para cada arena: lê arena_settings.replay_retention_days, encontra
// replays mais antigos que a retenção, apaga do R2, registra em
// r2_deletion_logs e só remove a linha de `replays` após sucesso no R2.
//
// Agende via cron do próprio host (crontab) ou scheduler externo
// (Cloudflare Cron Trigger / GitHub Actions schedule), ex:
//   0 4 * * * curl -X POST https://looplance.app/api/public/cron/cleanup-replays \
//     -H "x-cron-secret: $CRON_SECRET"

import { createAPIFileRoute } from '@tanstack/start/api'
import { requireCronSecret, EdgeAuthError } from '../../../../_lib/edgeAuth.server'
import { supabaseAdmin } from '../../../../_lib/supabaseAdmin.server'
import { deleteFromR2 } from '../../../../_lib/r2.server'

export const Route = createAPIFileRoute('/api/public/cron/cleanup-replays')({
  POST: async ({ request }) => {
    try {
      requireCronSecret(request)
      const db = supabaseAdmin()

      const { data: settings, error: settingsErr } = await db
        .from('arena_settings')
        .select('arena_id, replay_retention_days, auto_cleanup_enabled')
        .eq('auto_cleanup_enabled', true)

      if (settingsErr) throw new EdgeAuthError(`Erro lendo arena_settings: ${settingsErr.message}`, 500)

      // Fallback global caso alguma arena não tenha replay_retention_days
      // configurado (não deveria acontecer, já que arena_settings tem
      // default 30, mas defende contra null/0).
      const fallbackTtlDays = Number(process.env.REPLAY_TTL_HOURS ?? '72') / 24

      let deleted = 0
      let failed = 0

      for (const s of settings ?? []) {
        const retentionDays = s.replay_retention_days || fallbackTtlDays
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - retentionDays)

        const { data: expired, error: expiredErr } = await db
          .from('replays')
          .select('id, r2_key')
          .eq('arena_id', s.arena_id)
          .lt('created_at', cutoff.toISOString())

        if (expiredErr) {
          console.error('erro lendo replays expirados', s.arena_id, expiredErr)
          continue
        }

        for (const replay of expired ?? []) {
          try {
            await deleteFromR2(replay.r2_key)
            await db.from('r2_deletion_logs').insert({
              replay_id: replay.id,
              r2_key: replay.r2_key,
              status: 'success',
            })
            await db.from('replays').delete().eq('id', replay.id)
            deleted++
          } catch (e: any) {
            failed++
            await db.from('r2_deletion_logs').insert({
              replay_id: replay.id,
              r2_key: replay.r2_key,
              status: 'error',
              error_message: String(e?.message ?? e),
            })
          }
        }
      }

      return Response.json({ ok: true, deleted, failed })
    } catch (err) {
      if (err instanceof EdgeAuthError) {
        return Response.json({ error: err.message }, { status: err.status })
      }
      console.error(err)
      return Response.json({ error: 'internal_error' }, { status: 500 })
    }
  },
})
