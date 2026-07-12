// app/routes/api/public/edge/replay.ts
//
// POST /api/public/edge/replay   (spec 6.3)
// Headers: Authorization: Bearer <edge_token>
// Body: { quadra_id, r2_key, video_url, duration_sec, file_size_bytes }
//
// Fluxo: valida edge_token -> resolve arena_id via quadra_id -> confere que
// a quadra pertence à mesma arena do device -> INSERT em replays com
// service role. O trigger `trig_log_replay_creation` já existente cuida da
// auditoria em debug_logs, e a publicação de Realtime em `replays` já
// habilitada (seção 7) entrega o evento pro PWA.

import { createAPIFileRoute } from '@tanstack/start/api'
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from '../../../../_lib/edgeAuth.server'
import { supabaseAdmin } from '../../../../_lib/supabaseAdmin.server'

interface ReplayBody {
  quadra_id: string
  r2_key?: string
  video_url?: string
  duration_sec?: number
  file_size_bytes?: number
  status?: string
}

export const Route = createAPIFileRoute('/api/public/edge/replay')({
  POST: async ({ request }) => {
    try {
      const device = await requireEdgeDevice(request)
      const rawBody = await request.text()
      await requireEdgeSignature(request, rawBody)
      const body = JSON.parse(rawBody) as Partial<ReplayBody>

      if (!body.quadra_id) {
        return Response.json({ error: 'campo obrigatório ausente: quadra_id' }, { status: 400 })
      }

      const db = supabaseAdmin()

      const { data: quadra, error: quadraErr } = await db
        .from('quadras')
        .select('id, arena_id')
        .eq('id', body.quadra_id)
        .maybeSingle()

      if (quadraErr) throw new EdgeAuthError(`Erro lendo quadra: ${quadraErr.message}`, 500)
      if (!quadra) {
        return Response.json({ error: 'quadra_id não encontrada' }, { status: 404 })
      }
      if (quadra.arena_id !== device.arena_id) {
        return Response.json(
          { error: 'quadra não pertence à arena deste edge device' },
          { status: 403 },
        )
      }

      const insertData: Record<string, unknown> = {
        arena_id: quadra.arena_id,
        quadra_id: quadra.id,
        edge_device_id: device.id,
        status: body.status ?? 'ready',
      }
      if (body.video_url) insertData.video_url = body.video_url
      if (body.r2_key) insertData.r2_key = body.r2_key
      if (body.duration_sec !== undefined) insertData.duration_sec = body.duration_sec
      if (body.file_size_bytes !== undefined) insertData.file_size_bytes = body.file_size_bytes

      const { data: replay, error: insertErr } = await db
        .from('replays')
        .insert(insertData)
        .select()
        .single()

      if (insertErr) throw new EdgeAuthError(`Erro inserindo replay: ${insertErr.message}`, 500)

      return Response.json({ replay }, { status: 201 })
    } catch (err) {
      if (err instanceof EdgeAuthError) {
        return Response.json({ error: err.message }, { status: err.status })
      }
      console.error(err)
      return Response.json({ error: 'internal_error' }, { status: 500 })
    }
  },
})
