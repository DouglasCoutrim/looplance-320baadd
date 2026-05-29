import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STREAMING_SERVER_API_URL = "https://api.izyia.com.br/v3/config/paths/add/"

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const payload = await req.json()
    console.log("Receiving webhook payload:", JSON.stringify(payload, null, 2))

    const camera = payload.record

    if (!camera || !camera.id || !camera.rtsp_url) {
      console.error("Missing required camera data (id or rtsp_url)")
      return new Response(
        JSON.stringify({ error: "Missing required camera data" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const apiUrl = `${STREAMING_SERVER_API_URL}${camera.id}`
    const body = {
      source: camera.rtsp_url,
      sourceOnDemand: true
    }

    console.log(`Sending POST request to: ${apiUrl}`)

    let streamingResponseStatus = 'success'
    let errorMessage = null

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const responseText = await response.text()
      console.log(`Streaming server response status: ${response.status}`)

      if (!response.ok) {
        streamingResponseStatus = 'error'
        errorMessage = `Streaming server error: ${response.status} - ${responseText}`
        console.error(errorMessage)
      }
    } catch (fetchError) {
      streamingResponseStatus = 'error'
      errorMessage = `Failed to connect to streaming server: ${fetchError.message}`
      console.error(errorMessage)
    }

    // Update the camera record with the result
    const { error: updateError } = await supabaseClient
      .from('cameras')
      .update({
        streaming_status: streamingResponseStatus,
        streaming_error: errorMessage
      })
      .eq('id', camera.id)

    if (updateError) {
      console.error("Error updating camera status in database:", updateError.message)
    }

    return new Response(
      JSON.stringify({ 
        success: streamingResponseStatus === 'success', 
        message: streamingResponseStatus === 'success' ? "Camera registered successfully" : errorMessage 
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Global error in register-camera-stream function:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
