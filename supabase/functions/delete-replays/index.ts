import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1"
import { S3Client, DeleteObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.1053.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )

    const { replays } = await req.json() as { replays: { id: string, r2_key: string }[] }
    console.log(`Deleting ${replays?.length} replays`);

    const s3Client = new S3Client({
      region: "auto",
      endpoint: Deno.env.get('R2_ENDPOINT_URL') || '',
      credentials: {
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') || '',
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') || '',
      },
    })

    const bucketName = Deno.env.get('R2_BUCKET_NAME') || ''
    const results = []

    for (const replay of replays) {
      try {
        // 1. Delete from R2
        if (replay.r2_key) {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: replay.r2_key,
          })
          await s3Client.send(deleteCommand)
        }

        // 2. Delete from Database
        const { error: dbError } = await supabaseClient
          .from('replays')
          .delete()
          .eq('id', replay.id)

        if (dbError) throw dbError

        results.push({ id: replay.id, status: 'success' })
      } catch (err) {
        console.error(`Error deleting replay ${replay.id}:`, err)
        results.push({ id: replay.id, status: 'error', error: err.message })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
