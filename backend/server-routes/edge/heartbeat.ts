// app/routes/api/public/edge/heartbeat.ts
//
// POST /api/public/edge/heartbeat   (spec 6.2)
//
// A spec diz para MANTER o comportamento atual (o script bash do Edge faz
// PATCH direto em /rest/v1/edge_devices com a anon key). O Edge Agent deste
// projeto já faz isso em edge-agent/api_client.py::send_heartbeat().
//
// Esta rota existe como fallback/alternativa passando pelo backend (útil
// se algum dia quisermos tirar a anon key do Edge, ou logar heartbeats),
// usando o mesmo esquema de autenticação por edge_token dos outros
// endpoints /api/public/edge/*.

import { createAPIFileRoute } from '@tanstack/start/api'
import { requireEdgeDevice, requireEdgeSignature, EdgeAuthError } from '../../../../_lib/edgeAuth.server'
import { supabaseAdmin } from '../../../../_lib/supabaseAdmin.server'

export const Route = createAPIFileRoute('/api/public/edge/heartbeat')({
  POST: async ({ request }) => {
    try {
      const device = await requireEdgeDevice(request)
      const rawBody = await request.text()
      await requireEdgeSignature(request, rawBody)
      const body = JSON.parse(rawBody) as {
        hostname?: string
        local_ip?: string
        uptime_seconds?: number
        edge_version?: string
      }

      const db = supabaseAdmin()
      const { error } = await db
        .from('edge_devices')
        .update({
          status: 'online',
          last_seen: new Date().toISOString(),
          hostname: body.hostname ?? undefined,
          local_ip: body.local_ip ?? undefined,
          uptime_seconds: body.uptime_seconds ?? undefined,
          edge_version: body.edge_version ?? undefined,
        })
        .eq('id', device.id)

      if (error) throw new EdgeAuthError(`Erro atualizando heartbeat: ${error.message}`, 500)

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
