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

    const authHeader = req.headers.get('Authorization');
    
    // Authorization check
    let isAuthorized = false;
    
    if (authHeader) {
      console.log('Checking auth header...');
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader || '' } } }
      )
      const { data: { user }, error: userError } = await userClient.auth.getUser()
      if (user) {
        console.log('User found:', user.id);
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('is_super_admin, is_arena_owner')
          .eq('id', user.id)
          .single()
        
        if (profile?.is_super_admin || profile?.is_arena_owner) {
          isAuthorized = true;
          console.log('User is authorized via profile');
        } else {
          console.log('User not authorized via profile:', profile);
        }
      } else {
        console.log('No user found or error:', userError);
      }
      
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (serviceRoleKey && authHeader.includes(serviceRoleKey)) {
        isAuthorized = true;
        console.log('Authorized via service role key');
      }
    } else {
      console.log('No auth header provided');
    }

    if (!isAuthorized) {
      console.error('Unauthorized access attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
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
      forcePathStyle: true,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    })

    const results = []
    console.log(`Processing deletion for ${replays.length} replays. R2 Bucket: ${bucketName}`);

    for (const replay of replays) {
      const result = { id: replay.id, r2_status: 'skipped', db_status: 'pending', error: null };
      
      try {
        // 1. Delete from R2
        if (replay.r2_key) {
          try {
            console.log(`Deleting from R2: ${replay.r2_key}`);
            const deleteCommand = new DeleteObjectCommand({
              Bucket: bucketName,
              Key: replay.r2_key,
            })
            await s3Client.send(deleteCommand)
            result.r2_status = 'success'
          } catch (r2Err) {
            console.error(`Error deleting from R2 for replay ${replay.id}:`, r2Err)
            result.r2_status = 'error'
            result.error = `R2 Error: ${r2Err.message}`
          }
        }

        // 2. Delete from Database
        const { error: dbError } = await supabaseClient
          .from('replays')
          .delete()
          .eq('id', replay.id)

        if (dbError) {
          console.error(`Error deleting from DB for replay ${replay.id}:`, dbError)
          result.db_status = 'error'
          result.error = result.error ? `${result.error} | DB Error: ${dbError.message}` : `DB Error: ${dbError.message}`
        } else {
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