// app/routes/api/public/edge/replay-complete.ts
//
// POST /api/public/edge/replay-complete
// Atualiza replay de 'processing' para 'ready' apos upload bem-sucedido.
import { createAPIFileRoute } from '@tanstack/start/api'
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from '../../../../_lib/edgeAuth.server'
import { supabaseAdmin } from '../../../../_lib/supabaseAdmin.server'

interface ReplayCompleteBody {
  replay_id: string
  status: string
  r2_key: string
  video_url: string
  duration_sec: number
  file_size_bytes: number
}

export const Route = createAPIFileRoute('/api/public/edge/replay-complete')({
  POST: async ({ request }) => {
    try {
      const device = await requireEdgeDevice(request)
      const rawBody = await request.text()
      await requireEdgeSignature(request, rawBody)
      const body = JSON.parse(rawBody) as Partial<ReplayCompleteBody>

      if (!body.replay_id || !body.status) {
        return Response.json({ error: 'campos obrigatorios ausentes: replay_id, status' }, { status: 400 })
      }

      const updateData: Record<string, unknown> = { status: body.status }
      if (body.r2_key) updateData.r2_key = body.r2_key
      if (body.video_url) updateData.video_url = body.video_url
      if (body.duration_sec) updateData.duration_sec = body.duration_sec
      if (body.file_size_bytes) updateData.file_size_bytes = body.file_size_bytes

      const db = supabaseAdmin()
      const { error } = await db
        .from('replays')
        .update(updateData)
        .eq('id', body.replay_id)
        .eq('edge_device_id', device.id)

      if (error) throw new EdgeAuthError(`Erro atualizando replay: ${error.message}`, 500)

      return Response.json({ ok: true }, { status: 200 })
    } catch (err) {
      if (err instanceof EdgeAuthError) {
        return Response.json({ error: err.message }, { status: err.status })
      }
      console.error(err)
      return Response.json({ error: 'internal_error' }, { status: 500 })
    }
  },
})
