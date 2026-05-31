-- RLS Policies Backup

-- Arenas
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage arenas" ON public.arenas TO authenticated USING (is_super_admin());
CREATE POLICY "Public can view arenas" ON public.arenas FOR SELECT TO public USING (true);

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles view" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()) OR is_super_admin() OR is_arena_owner);
CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Profiles admin manage" ON public.profiles TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admins can view all profiles" ON public.profiles FOR SELECT TO public USING (is_super_admin());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid()) OR is_super_admin());

-- Edge Devices
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage edge_devices" ON public.edge_devices TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)));

-- Cameras
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage cameras" ON public.cameras TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)));

-- Input Boards
ALTER TABLE public.input_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage input_boards" ON public.input_boards TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)));

-- Arena Settings
ALTER TABLE public.arena_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage arena_settings" ON public.arena_settings TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)));

-- Replays
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable delete for authenticated users" ON public.replays FOR DELETE TO authenticated USING (true);
CREATE POLICY "Public can view replays" ON public.replays FOR SELECT TO public USING (true);

-- Storage Objects (Example Policies)
-- CREATE POLICY "Admins can upload overlays" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'overlays'::text) AND (is_super_admin() OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_arena_owner = true))));
-- CREATE POLICY "Public view arena photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'arenas'::text);
