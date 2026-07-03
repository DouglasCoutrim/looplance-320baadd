
DROP TRIGGER IF EXISTS register_camera_stream_trigger ON public.cameras;
DROP FUNCTION IF EXISTS public.trig_register_camera_stream();

-- Reset câmeras que ficaram presas em 'error' por causa do trigger antigo
UPDATE public.cameras
   SET streaming_status = 'starting',
       streaming_error = NULL
 WHERE streaming_error LIKE '%Cloudflare%'
    OR streaming_error LIKE '%Streaming server error%';

-- Auto-vincular arena_id do edge_device quando ainda nulo, herdando da quadra
-- da câmera (assume-se 1 arena por edge, o que já é o caso operacional).
UPDATE public.edge_devices ed
   SET arena_id = q.arena_id
  FROM public.cameras c
  JOIN public.quadras q ON q.id = c.quadra_id
 WHERE c.edge_device_id = ed.id
   AND ed.arena_id IS NULL
   AND q.arena_id IS NOT NULL;
