import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { S3Client, DeleteObjectsCommand } from "https://esm.sh/@aws-sdk/client-s3@3.341.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { arena_id, action } = await req.json()

    if (action === 'clear_all') {
      if (!arena_id) throw new Error('arena_id is required')

      // 1. Get all replays for this arena (via quadras)
      const { data: replays, error: fetchError } = await supabase
        .from('replays')
        .select('id, video_url, r2_key, quadra_id')
        .filter('quadra_id', 'in', 
          supabase.from('quadras').select('id').eq('arena_id', arena_id)
        )

      if (fetchError) throw fetchError

      if (!replays || replays.length === 0) {
        return new Response(JSON.stringify({ success: true, deleted_count: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const keysToDelete = replays.map(r => r.r2_key || r.video_url.split('/').pop()).filter(Boolean) as string[]
      
      // 2. Delete from R2
      const deletedFromR2 = await deleteFromR2(keysToDelete)

      // 3. Delete from DB
      const replayIds = replays.map(r => r.id)
      const { error: deleteError } = await supabase
        .from('replays')
        .delete()
        .in('id', replayIds)

      if (deleteError) throw deleteError

      console.log(`Cleared ${replays.length} replays for arena ${arena_id}`)

      return new Response(JSON.stringify({ 
        success: true, 
        deleted_count: replays.length,
        r2_success: deletedFromR2 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'auto_cleanup') {
      // Manual trigger for the cleanup job
      const result = await runAutoCleanup(supabase)
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

async function deleteFromR2(keys: string[]) {
  if (keys.length === 0) return true
  
  try {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: Deno.env.get('R2_ENDPOINT') ?? '',
      credentials: {
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') ?? '',
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '',
      },
    })

    const bucket = Deno.env.get('R2_BUCKET_NAME') ?? ''
    
    // R2 supports batch delete up to 1000 objects
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000)
      const command = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map(key => ({ Key: key })),
        },
      })
      await s3.send(command)
    }
    
    return true
  } catch (err) {
    console.error('R2 Delete Error:', err)
    return false
  }
}

async function runAutoCleanup(supabase: any) {
  // 1. Get all arenas with auto_cleanup enabled
  const { data: settings, error: settingsError } = await supabase
    .from('arena_settings')
    .select('arena_id, replay_retention_days')
    .eq('auto_cleanup_enabled', true)

  if (settingsError) throw settingsError

  let totalDeleted = 0

  for (const setting of settings) {
    const limitDate = new Date()
    limitDate.setDate(limitDate.getDate() - setting.replay_retention_days)

    // Find old replays for this arena
    // Subquery to get quadra_ids of the arena
    const { data: oldReplays, error: fetchError } = await supabase
      .from('replays')
      .select('id, video_url, r2_key')
      .lt('created_at', limitDate.toISOString())
      .filter('quadra_id', 'in', 
        supabase.from('quadras').select('id').eq('arena_id', setting.arena_id)
      )

    if (fetchError) {
      console.error(`Error fetching replays for arena ${setting.arena_id}:`, fetchError)
      continue
    }

    if (oldReplays && oldReplays.length > 0) {
      const keys = oldReplays.map((r: any) => r.r2_key || r.video_url.split('/').pop()).filter(Boolean)
      await deleteFromR2(keys)
      
      const ids = oldReplays.map((r: any) => r.id)
      await supabase.from('replays').delete().in('id', ids)
      
      totalDeleted += oldReplays.length
      console.log(`Auto-cleaned ${oldReplays.length} replays for arena ${setting.arena_id}`)
    }
  }

  return { success: true, total_deleted: totalDeleted }
}
