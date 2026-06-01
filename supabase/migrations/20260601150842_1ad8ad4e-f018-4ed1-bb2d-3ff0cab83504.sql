-- 1. Ensure debug_logs is properly structured for our needs
-- (Already exists, but we'll use it extensively)

-- 2. Create function to find the correct camera and log the process
CREATE OR REPLACE FUNCTION public.fn_get_camera_for_replay(p_quadra_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_camera RECORD;
    v_log_msg TEXT;
BEGIN
    -- Log the request
    INSERT INTO public.debug_logs (message) 
    VALUES ('REPLAY REQUEST: Solicitado replay para quadra_id ' || p_quadra_id);

    -- Find the camera explicitly by quadra_id
    SELECT * INTO v_camera
    FROM public.cameras
    WHERE quadra_id = p_quadra_id
    AND active = true
    LIMIT 1;

    IF v_camera.id IS NULL THEN
        v_log_msg := 'REPLAY ERROR: Nenhuma câmera ativa encontrada para quadra_id ' || p_quadra_id;
        INSERT INTO public.debug_logs (message) VALUES (v_log_msg);
        RETURN jsonb_build_object('error', v_log_msg);
    END IF;

    -- Log the camera found
    v_log_msg := 'REPLAY FOUND: Camera ' || v_camera.name || ' (id: ' || v_camera.id || ') encontrada para quadra_id ' || v_camera.quadra_id;
    INSERT INTO public.debug_logs (message) VALUES (v_log_msg);

    RETURN row_to_json(v_camera)::jsonb;
END;
$$;

-- 3. Create a trigger function to log replay creation
CREATE OR REPLACE FUNCTION public.trig_log_replay_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.debug_logs (message)
    VALUES ('REPLAY CREATED: Replay id ' || NEW.id || ' criado para quadra_id ' || NEW.quadra_id || ' no dispositivo ' || COALESCE(NEW.edge_device_id::text, 'N/A'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach the trigger to the replays table
DROP TRIGGER IF EXISTS log_replay_creation_trigger ON public.replays;
CREATE TRIGGER log_replay_creation_trigger
AFTER INSERT ON public.replays
FOR EACH ROW
EXECUTE FUNCTION public.trig_log_replay_creation();

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.fn_get_camera_for_replay(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_camera_for_replay(UUID) TO service_role;
