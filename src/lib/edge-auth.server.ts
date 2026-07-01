// Server-only helpers to authenticate Edge Devices calling /api/public/edge/*.
// Two things are checked on every call:
//   1. `Authorization: Bearer <edge_token>` matches a row in edge_devices.
//   2. `X-Edge-Timestamp` + `X-Edge-Signature` = HMAC-SHA256(body) with EDGE_SHARED_SECRET,
//      inside a 5 minute window (prevents replay if edge_token leaks).
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_MS = 5 * 60 * 1000;

export type EdgeDeviceRow = {
  id: string;
  name: string;
  arena_id: string | null;
  edge_token: string | null;
};

function safeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyHmac(rawBody: string, timestamp: string, signature: string): boolean {
  const secret = process.env.EDGE_SHARED_SECRET;
  if (!secret) throw new Error("EDGE_SHARED_SECRET not configured");

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > MAX_SKEW_MS) return false;

  const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  return safeEqualStr(expected, signature);
}

export async function authenticateEdge(request: Request): Promise<
  { ok: true; device: EdgeDeviceRow; rawBody: string } | { ok: false; status: number; message: string }
> {
  const auth = request.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, message: "Missing bearer token" };
  }
  const token = auth.slice(7).trim();
  if (!token) return { ok: false, status: 401, message: "Empty bearer token" };

  const rawBody = request.method === "GET" ? "" : await request.text();

  // HMAC required only for state-changing methods
  if (request.method !== "GET") {
    const ts = request.headers.get("x-edge-timestamp") || "";
    const sig = request.headers.get("x-edge-signature") || "";
    if (!ts || !sig) return { ok: false, status: 401, message: "Missing HMAC headers" };
    if (!verifyHmac(rawBody, ts, sig)) return { ok: false, status: 401, message: "Invalid HMAC" };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("edge_devices")
    .select("id, name, arena_id, edge_token")
    .eq("edge_token", token)
    .maybeSingle();

  if (error || !data) return { ok: false, status: 401, message: "Unknown edge token" };
  return { ok: true, device: data as EdgeDeviceRow, rawBody };
}

export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("x-cron-secret") || "";
  if (!provided) return false;
  return safeEqualStr(provided, secret);
}
