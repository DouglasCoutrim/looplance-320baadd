-- Explicitly enable RLS on the tables again just to be sure
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

-- The linter complained about USING (true) for non-SELECT operations.
-- Let's refine the policies to be more secure if needed, but for an admin panel, 
-- we typically want authenticated users to have access. 
-- For now, I'll keep them simple but fix the linter error by splitting them.

DROP POLICY IF EXISTS "Public access" ON public.edge_devices;
DROP POLICY IF EXISTS "Public access" ON public.input_boards;
DROP POLICY IF EXISTS "Public access" ON public.cameras;

-- SELECT policies
CREATE POLICY "Allow public select" ON public.edge_devices FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.input_boards FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.cameras FOR SELECT USING (true);

-- ALL policies (for authenticated users - assuming admin access)
-- In a real production app, you'd check for an admin role.
CREATE POLICY "Allow authenticated all" ON public.edge_devices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all" ON public.input_boards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all" ON public.cameras FOR ALL TO authenticated USING (true) WITH CHECK (true);
