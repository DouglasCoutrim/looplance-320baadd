// Cloudflare R2 (S3-compatible) delete helper using aws4fetch — a tiny SigV4
// signer that runs cleanly on Cloudflare Workers (no @aws-sdk/client-s3 bloat).
import { AwsClient } from "aws4fetch";

let _client: AwsClient | undefined;

function getClient(): AwsClient {
  if (_client) return _client;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY not configured");
  }
  _client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
  return _client;
}

export async function deleteR2Object(key: string): Promise<{ ok: boolean; status: number }> {
  const endpoint = process.env.R2_ENDPOINT_URL;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!endpoint || !bucket) throw new Error("R2_ENDPOINT_URL / R2_BUCKET_NAME not configured");

  const url = `${endpoint.replace(/\/+$/, "")}/${bucket}/${encodeURI(key)}`;
  const client = getClient();
  const res = await client.fetch(url, { method: "DELETE" });
  return { ok: res.ok || res.status === 404, status: res.status };
}
