// _lib/r2.server.ts
//
// Cliente S3-compatible para o Cloudflare R2. Usado pelo cron de limpeza
// (6.6) para deletar vídeos expirados. O upload do vídeo em si é feito
// pelo Edge Agent (Python), não pelo servidor -- aqui só precisamos de
// DELETE.

import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

let _client: S3Client | null = null

function r2Client(): S3Client {
  if (_client) return _client

  const endpoint = process.env.R2_ENDPOINT_URL
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Credenciais R2 ausentes no ambiente do servidor')
  }

  _client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  })
  return _client
}

export async function deleteFromR2(key: string): Promise<void> {
  const bucket = process.env.R2_BUCKET_NAME
  if (!bucket) throw new Error('R2_BUCKET_NAME ausente no ambiente do servidor')

  await r2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
