The bug occurs because the replay generation logic (likely on the Edge Device) is incorrectly selecting the camera by `edge_device_id` instead of `quadra_id`. Since both "Areia Coberta" and "Sintético Teste" share the same `edge_device_id`, the system is defaulting to the first camera found (Areia Coberta).

I will implement a robust server-side flow to fix this and provide the requested logging.

### Technical Details
- **SQL Migration**:
    - Ensure `debug_logs` is ready for the requested logs.
    - Create a function `fn_get_camera_for_replay` that takes a `quadra_id`, logs the request details to `debug_logs`, and returns the specific camera assigned to that quadra.
    - Add a trigger on the `replays` table to log every successful insertion, including the `quadra_id` and `edge_device_id` used.
- **Edge Function**:
    - Create a new Edge Function `generate-replay` that acts as the secure endpoint for the Edge Device.
    - This function will use the new SQL function to ensure the correct camera is identified.
    - It will log all steps of the process to `debug_logs` for easy troubleshooting.

### User Section
- The fix involves moving the camera selection logic to the database to ensure it's always tied to the specific court (`quadra_id`).
- I am adding detailed logging so you can see exactly which court was requested and which camera was selected in the `debug_logs` table.
- You will need to update your Edge Device to call the new `generate-replay` endpoint or use the new SQL function to get the correct configuration.
