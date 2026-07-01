// app/routes/api/public/edge/camera-status.ts
//
// POST /api/public/edge/camera-status   (spec 6.4)
// Headers: Authorization: Bearer <edge_token>
// Body: { camera_id, streaming_status, streaming_error? }
//
// Atualiza cameras.streaming_status/streaming_error. Realtime na tabela
// `cameras` (seção 7) já propaga isso pro admin ao vivo.

import { createAPIFileRoute } from '@tanstack/start/api'
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from '../../../../_lib/edgeAuth.server'
import { supabaseAdmin } from '../../../../_lib/supabaseAdmin.server'

const VALID_STATUSES = new Set(['online', 'offline', 'error', 'starting'])

export const Route = createAPIFileRoute('/api/public/edge/camera-status')({
  POST: async ({ request }) => {
    try {
      const device = await requireEdgeDevice(request)
      const rawBody = await request.text()
      await requireEdgeSignature(request, rawBody)
      const body = JSON.parse(rawBody) as {
        camera_id?: string
        streaming_status?: string
        streaming_error?: string | null
      }

      if (!body.camera_id || !body.streaming_status) {
        return Response.json(
          { error: 'campos obrigatórios: camera_id, streaming_status' },
          { status: 400 },
        )
      }
      if (!VALID_STATUSES.has(body.streaming_status)) {
        return Response.json({ error: 'streaming_status inválido' }, { status: 400 })
      }

      const db = supabaseAdmin()

      // garante que a câmera pertence a este edge device antes de escrever
      const { data: camera, error: camErr } = await db
        .from('cameras')
        .select('id, edge_device_id')
        .eq('id', body.camera_id)
        .maybeSingle()

      if (camErr) throw new EdgeAuthError(`Erro lendo camera: ${camErr.message}`, 500)
      if (!camera) return Response.json({ error: 'camera_id não encontrada' }, { status: 404 })
      if (camera.edge_device_id !== device.id) {
        return Response.json({ error: 'câmera não pertence a este edge device' }, { status: 403 })
      }

      const { error: updateErr } = await db
        .from('cameras')
        .update({
          streaming_status: body.streaming_status,
          streaming_error: body.streaming_error ?? null,
        })
        .eq('id', body.camera_id)

      if (updateErr) throw new EdgeAuthError(`Erro atualizando camera: ${updateErr.message}`, 500)

      return Response.json({ ok: true })
    } catch (err) {
      if (err instanceof EdgeAuthError) {
        return Response.json({ error: err.message }, { status: err.status })
      }
      console.error(err)
      return Response.json({ error: 'internal_error' }, { status: 500 })
    }
  },
})
