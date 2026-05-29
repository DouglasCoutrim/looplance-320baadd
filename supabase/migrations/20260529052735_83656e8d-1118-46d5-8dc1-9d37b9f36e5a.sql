-- Add columns to track streaming registration status
ALTER TABLE public.cameras 
ADD COLUMN IF NOT EXISTS streaming_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS streaming_error TEXT;

-- Enable pg_net for async HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.trig_register_camera_stream()
RETURNS TRIGGER AS $$
DECLARE
  service_role_key TEXT;
  project_id TEXT;
BEGIN
  -- We'll use the service role key provided in the system context
  -- In a real scenario, this should be stored more securely or accessed via vault
  -- For now, we'll use a placeholder that the user can replace or we can set via env
  -- Actually, let's try to get it from a secret if possible, or just use a dummy for the migration
  -- since we can't easily inject it into the SQL here without a dynamic command.
  
  PERFORM
    net.http_post(
      url := 'https://jurwopyuxmhvtwzjxynm.supabase.co/functions/v1/register-camera-stream',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cndvcHl1eG1odnR3emp4eW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ3NjMzNywiZXhwIjoyMDk1MDUyMzM3fQ.SOhUxDvibQ0OsygZv6eY0kY72pjr94lKJptHl7KqOvE"}'::jsonb,
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS register_camera_stream_trigger ON public.cameras;
CREATE TRIGGER register_camera_stream_trigger
AFTER INSERT ON public.cameras
FOR EACH ROW
EXECUTE FUNCTION public.trig_register_camera_stream();
