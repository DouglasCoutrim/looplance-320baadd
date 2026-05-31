-- Triggers Backup

CREATE TRIGGER on_arena_created 
AFTER INSERT ON public.arenas 
FOR EACH ROW EXECUTE FUNCTION handle_new_arena_settings();

CREATE TRIGGER trg_prevent_role_self_elevation 
BEFORE UPDATE ON public.profiles 
FOR EACH ROW EXECUTE FUNCTION prevent_role_self_elevation();

-- Camera Stream registration trigger
-- This typically calls an edge function via pg_net or similar, definition might be complex
-- Reconstructing based on existing trigger definitions found:
CREATE TRIGGER register_camera_stream_trigger 
AFTER INSERT ON public.cameras 
FOR EACH ROW EXECUTE FUNCTION trig_register_camera_stream();

-- Trigger for Auth handle_new_user (This one is usually on auth.users)
-- CREATE TRIGGER on_auth_user_created
-- AFTER INSERT ON auth.users
-- FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
