-- Ensure edge_token has a default value if missing
ALTER TABLE public.edge_devices ALTER COLUMN edge_token SET DEFAULT gen_random_uuid()::text;

-- Re-enable RLS just in case
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;

-- Drop existing manage policies to recreate them cleanly
DROP POLICY IF EXISTS "Allow authenticated all arenas" ON public.arenas;
DROP POLICY IF EXISTS "Allow authenticated manage edge_devices" ON public.edge_devices;
DROP POLICY IF EXISTS "Allow authenticated all edge_devices" ON public.edge_devices;

-- Create comprehensive policies for arenas
CREATE POLICY "Allow authenticated manage arenas" 
ON public.arenas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Create comprehensive policies for edge_devices
CREATE POLICY "Allow authenticated manage edge_devices" 
ON public.edge_devices 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Ensure public read still works
DROP POLICY IF EXISTS "Allow public read arenas" ON public.arenas;
CREATE POLICY "Allow public read arenas" ON public.arenas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read edge_devices" ON public.edge_devices;
CREATE POLICY "Allow public read edge_devices" ON public.edge_devices FOR SELECT USING (true);
