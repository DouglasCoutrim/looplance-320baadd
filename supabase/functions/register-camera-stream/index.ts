import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const STREAMING_SERVER_API_URL = "https://api.izyia.com.br/v3/config/paths/add/"

serve(async (req) => {
  try {
    const payload = await req.json()
    console.log("Receiving webhook payload:", JSON.stringify(payload, null, 2))

    // Supabase webhooks send data in record field for INSERT/UPDATE
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
    console.log(`Payload: ${JSON.stringify(body)}`)

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const responseText = await response.text()
    console.log(`Streaming server response status: ${response.status}`)
    console.log(`Streaming server response body: ${responseText}`)

    if (!response.ok) {
      throw new Error(`Streaming server returned error: ${response.status} - ${responseText}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: "Camera registered successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Error in register-camera-stream function:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
