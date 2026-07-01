// _lib/edgeAuth.server.ts
//
// Valida o header `Authorization: Bearer <edge_token>` contra
// edge_devices.edge_token usando o service role, e devolve a linha do
// device autenticado. Todos os handlers /api/public/edge/* usam isso
// como primeira linha do handler (spec seção 5 / 11: "Endpoints
// /api/public/* validam assinatura/token antes de qualquer escrita").

import { supabaseAdmin } from './supabaseAdmin.server'

export class EdgeAuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

export interface EdgeDeviceRow {
  id: string
  arena_id: string
  name: string
  edge_token: string
  status: string
}

export async function requireEdgeDevice(request: Request): Promise<EdgeDeviceRow> {
  const authHeader = request.headers.get('authorization') ?? ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]

  if (!token) {
    throw new EdgeAuthError('Header Authorization: Bearer <edge_token> ausente')
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('edge_devices')
    .select('id, arena_id, name, edge_token, status')
    .eq('edge_token', token)
    .maybeSingle()

  if (error) {
    throw new EdgeAuthError(`Erro validando edge_token: ${error.message}`, 500)
  }
  if (!data) {
    throw new EdgeAuthError('edge_token inválido', 401)
  }

  return data as EdgeDeviceRow
}

/** Compara dois valores em tempo constante (evita timing attack no CRON_SECRET). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Verifica a assinatura HMAC-SHA256 enviada pelo Edge Agent, além do
 * Bearer edge_token. Defesa em profundidade: mesmo que um edge_token
 * vaze, sem EDGE_SHARED_SECRET (que só existe no /etc/looplance/edge.env
 * de cada device + no ambiente do servidor) não dá pra forjar heartbeat,
 * camera-status ou replay.
 *
 * Headers esperados:
 *   X-Edge-Timestamp: <unix ms>
 *   X-Edge-Signature: hex( HMAC_SHA256(EDGE_SHARED_SECRET, `${timestamp}.${rawBody}`) )
 *
 * `rawBody` é '' para GET. Tolerância de relógio: 5 minutos (evita replay
 * de requisições antigas capturadas).
 */
export async function requireEdgeSignature(request: Request, rawBody: string): Promise<void> {
  const secret = process.env.EDGE_SHARED_SECRET
  if (!secret) {
    throw new EdgeAuthError('EDGE_SHARED_SECRET não configurado no servidor', 500)
  }

  const timestamp = request.headers.get('x-edge-timestamp')
  const signature = request.headers.get('x-edge-signature')
  if (!timestamp || !signature) {
    throw new EdgeAuthError('Headers X-Edge-Timestamp / X-Edge-Signature ausentes', 401)
  }

  const skewMs = Math.abs(Date.now() - Number(timestamp))
  if (!Number.isFinite(skewMs) || skewMs > 5 * 60 * 1000) {
    throw new EdgeAuthError('X-Edge-Timestamp fora da janela permitida (relógio dessincronizado?)', 401)
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`)
  if (!timingSafeEqual(expected, signature.toLowerCase())) {
    throw new EdgeAuthError('X-Edge-Signature inválida', 401)
  }
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function requireCronSecret(request: Request): void {
  const provided = request.headers.get('x-cron-secret') ?? ''
  const expected = process.env.CRON_SECRET ?? ''
  if (!expected || !timingSafeEqual(provided, expected)) {
    throw new EdgeAuthError('x-cron-secret inválido ou ausente', 401)
  }
}
