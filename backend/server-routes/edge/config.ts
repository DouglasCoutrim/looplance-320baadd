// app/routes/api/public/edge/config.ts
//
// GET /api/public/edge/config
// Autenticado com edge_token. Devolve tudo que o Edge Agent precisa para
// subir sozinho: câmeras ativas do device, mapeamento de botoeiras e
// input_boards, para não precisar do Supabase Auth/anon key na leitura
// desses dados (que não são públicos).

import { createAPIFileRoute } from '@tanstack/start/api'
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from '../../../../_lib/edgeAuth.server'
import { supabaseAdmin } from '../../../../_lib/supabaseAdmin.server'

export const Route = createAPIFileRoute('/api/public/edge/config')({
  GET: async ({ request }) => {
    try {
      const device = await requireEdgeDevice(request)
      await requireEdgeSignature(request, '') // GET não tem body
      const db = supabaseAdmin()

      const [{ data: cameras, error: camErr }, { data: boards, error: boardErr }, { data: sponsors, error: spoErr }] =
        await Promise.all([
          db
            .from('cameras')
            .select(
              'id, name, quadra_id, rtsp_url, buffer_seconds, replay_seconds, trigger_button, ' +
                'overlay_url, final_overlay_url, video_x, video_y, video_width, video_height, active, ' +
                'stream_protocol, rtmp_stream_key, protocol_settings, aspect_ratio',
            )
            .eq('edge_device_id', device.id),
          db
            .from('input_boards')
            .select('id, name, device_name, vendor_id, product_id')
            .eq('edge_device_id', device.id),
          db
            .from('arena_sponsors')
            .select('logo_url, position_index')
            .eq('arena_id', device.arena_id)
            .eq('is_active', true)
            .order('position_index'),
        ])

      if (camErr) throw new EdgeAuthError(`Erro lendo cameras: ${camErr.message}`, 500)
      if (boardErr) throw new EdgeAuthError(`Erro lendo input_boards: ${boardErr.message}`, 500)
      if (spoErr) throw new EdgeAuthError(`Erro lendo arena_sponsors: ${spoErr.message}`, 500)

      const cameraIds = (cameras ?? []).map((c) => c.id)
      let botoeiras: any[] = []
      if (cameraIds.length > 0) {
        const { data, error } = await db
          .from('botoeiras')
          .select('id, camera_id, local_key, ip_local')
          .in('camera_id', cameraIds)
        if (error) throw new EdgeAuthError(`Erro lendo botoeiras: ${error.message}`, 500)
        botoeiras = data ?? []
      }

      return Response.json({
        device: { id: device.id, arena_id: device.arena_id, name: device.name },
        cameras: (cameras ?? []).map((c) => ({ ...c, arena_id: device.arena_id })),
        input_boards: boards ?? [],
        botoeiras,
        sponsors: sponsors ?? [],
      })
    } catch (err) {
      if (err instanceof EdgeAuthError) {
        return Response.json({ error: err.message }, { status: err.status })
      }
      console.error(err)
      return Response.json({ error: 'internal_error' }, { status: 500 })
    }
  },
})
