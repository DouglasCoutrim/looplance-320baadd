-- Enable RLS for all infrastructure tables
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards ENABLE ROW LEVEL SECURITY;

-- Arenas Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read arenas') THEN
        CREATE POLICY "Allow public read arenas" ON public.arenas FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated all arenas') THEN
        CREATE POLICY "Allow authenticated all arenas" ON public.arenas FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Quadras Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read quadras') THEN
        CREATE POLICY "Allow public read quadras" ON public.quadras FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated all quadras') THEN
        CREATE POLICY "Allow authenticated all quadras" ON public.quadras FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Edge Devices Policies
DO $$ BEGIN
    -- Clean up old overly restrictive or incorrect policies if any
    -- The user reports 401 when clicking "provisionar", which is an INSERT.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read edge_devices') THEN
        CREATE POLICY "Allow public read edge_devices" ON public.edge_devices FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated manage edge_devices') THEN
        CREATE POLICY "Allow authenticated manage edge_devices" ON public.edge_devices FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Cameras Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read cameras') THEN
        CREATE POLICY "Allow public read cameras" ON public.cameras FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated manage cameras') THEN
        CREATE POLICY "Allow authenticated manage cameras" ON public.cameras FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Input Boards Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read input_boards') THEN
        CREATE POLICY "Allow public read input_boards" ON public.input_boards FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated manage input_boards') THEN
        CREATE POLICY "Allow authenticated manage input_boards" ON public.input_boards FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Replays Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read replays') THEN
        CREATE POLICY "Allow public read replays" ON public.replays FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated manage replays') THEN
        CREATE POLICY "Allow authenticated manage replays" ON public.replays FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
