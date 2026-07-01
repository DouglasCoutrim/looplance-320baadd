// Autenticação de Edge Devices para /api/public/edge/*.
// Baseado em backend/server-routes/_lib/edgeAuth.server.ts.
//
// Camadas:
//   1. Authorization: Bearer <edge_token>  -> match em edge_devices.edge_token
//   2. X-Edge-Timestamp + X-Edge-Signature -> HMAC_SHA256(EDGE_SHARED_SECRET, `${ts}.${rawBody}`)
//      dentro de 5 min (janela contra replay).
//
// GET não tem body: rawBody = ''.

export class EdgeAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export interface EdgeDeviceRow {
  id: string;
  arena_id: string | null;
  name: string;
  edge_token: string | null;
  status: string | null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function requireEdgeDevice(request: Request): Promise<EdgeDeviceRow> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) throw new EdgeAuthError("Header Authorization: Bearer <edge_token> ausente");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("edge_devices")
    .select("id, arena_id, name, edge_token, status")
    .eq("edge_token", token)
    .maybeSingle();

  if (error) throw new EdgeAuthError(`Erro validando edge_token: ${error.message}`, 500);
  if (!data) throw new EdgeAuthError("edge_token inválido", 401);
  return data as EdgeDeviceRow;
}

export async function requireEdgeSignature(request: Request, rawBody: string): Promise<void> {
  const secret = process.env.EDGE_SHARED_SECRET;
  if (!secret) throw new EdgeAuthError("EDGE_SHARED_SECRET não configurado no servidor", 500);

  const timestamp = request.headers.get("x-edge-timestamp");
  const signature = request.headers.get("x-edge-signature");
  if (!timestamp || !signature) {
    throw new EdgeAuthError("Headers X-Edge-Timestamp / X-Edge-Signature ausentes", 401);
  }

  const skewMs = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(skewMs) || skewMs > 5 * 60 * 1000) {
    throw new EdgeAuthError("X-Edge-Timestamp fora da janela permitida (relógio dessincronizado?)", 401);
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  if (!timingSafeEqual(expected, signature.toLowerCase())) {
    throw new EdgeAuthError("X-Edge-Signature inválida", 401);
  }
}

export function requireCronSecret(request: Request): void {
  const expected = process.env.CRON_SECRET ?? "";
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!expected || !timingSafeEqual(provided, expected)) {
    throw new EdgeAuthError("x-cron-secret inválido ou ausente", 401);
  }
}
