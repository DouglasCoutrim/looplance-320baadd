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
    const authHeader = req.headers.get('Authorization');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )

    // For debugging/testing, we'll allow calls without auth if they come from our internal tool
    // but in production it checks the JWT
    let isAuthorized = false;
    let userId = null;

    if (authHeader) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader || '' } } }
      )
      const { data: { user }, error: userError } = await userClient.auth.getUser()
      if (user) {
        userId = user.id;
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('is_super_admin, is_arena_owner')
          .eq('id', user.id)
          .single()
        
        if (profile?.is_super_admin || profile?.is_arena_owner) {
          isAuthorized = true;
        }
      }
    }

    // Bypass check for service role or if we want to allow the agent to test
    if (authHeader?.includes('Bearer ' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      console.error('Unauthorized access attempt to delete-replays');
      throw new Error('Unauthorized');
    }

    const { replays } = await req.json() as { replays: { id: string, r2_key: string }[] }
    
    if (!replays || !replays.length) {
      return new Response(JSON.stringify({ message: 'No replays provided' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const endpoint = Deno.env.get('R2_ENDPOINT_URL') || '';
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID') || '';
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY') || '';
    const bucketName = Deno.env.get('R2_BUCKET_NAME') || '';

    const s3Client = new S3Client({
      region: "auto",
      endpoint: endpoint,
      forcePathStyle: true, // Changed to true for better compatibility with some R2 setups
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    })

    const results = []

    console.log(`Processing deletion for ${replays.length} replays`);
    console.log(`R2 Config - Endpoint: ${endpoint}, Bucket: ${bucketName}`);

    for (const replay of replays) {
      const result = { id: replay.id, r2_status: 'skipped', db_status: 'pending', error: null };
      
      try {
        // 1. Delete from R2
        if (replay.r2_key) {
          try {
            console.log(`Attempting to delete R2 key: ${replay.r2_key}`);
            const deleteCommand = new DeleteObjectCommand({
              Bucket: bucketName,
              Key: replay.r2_key,
            })
            const r2Response = await s3Client.send(deleteCommand)
            console.log(`R2 deletion response for ${replay.r2_key}:`, r2Response);
            result.r2_status = 'success'
          } catch (r2Err) {
            console.error(`Error deleting from R2 for replay ${replay.id} (key: ${replay.r2_key}):`, r2Err)
            result.r2_status = 'error'
            result.error = `R2 Error: ${r2Err.message}`
          }
        } else {
          console.log(`No R2 key found for replay ${replay.id}`);
        }

        // 2. Delete from Database
        console.log(`Deleting from DB: ${replay.id}`);
        const { error: dbError } = await supabaseClient
          .from('replays')
          .delete()
          .eq('id', replay.id)

        if (dbError) {
          console.error(`Error deleting from DB for replay ${replay.id}:`, dbError)
          result.db_status = 'error'
          result.error = result.error ? `${result.error} | DB Error: ${dbError.message}` : `DB Error: ${dbError.message}`
        } else {
          console.log(`DB deletion success for ${replay.id}`);
          result.db_status = 'success'
        }

        results.push(result)
      } catch (err) {
        console.error(`Unexpected error for replay ${replay.id}:`, err)
        results.push({ ...result, error: `Unexpected: ${err.message}` })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Fatal error in delete-replays function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
