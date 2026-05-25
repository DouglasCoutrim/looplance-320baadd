-- 1. Habilitar RLS em todas as tabelas
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Admins manage all arenas" ON public.arenas;
DROP POLICY IF EXISTS "Public can view arenas" ON public.arenas;
DROP POLICY IF EXISTS "arenas_select" ON public.arenas;
DROP POLICY IF EXISTS "Admins manage all arena_settings" ON public.arena_settings;
DROP POLICY IF EXISTS "Public can view arena settings" ON public.arena_settings;
DROP POLICY IF EXISTS "Super admins and owners manage edge_devices" ON public.edge_devices;
DROP POLICY IF EXISTS "Super admins and owners manage cameras" ON public.cameras;
DROP POLICY IF EXISTS "Super admins and owners manage input_boards" ON public.input_boards;
DROP POLICY IF EXISTS "Admins can see all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public can view quadras" ON public.quadras;
DROP POLICY IF EXISTS "quadras_select" ON public.quadras;
DROP POLICY IF EXISTS "Super admins manage all quadras" ON public.quadras;
DROP POLICY IF EXISTS "Public can view replays" ON public.replays;
DROP POLICY IF EXISTS "Super admins manage all replays" ON public.replays;

-- 3. Criar novas políticas simplificadas

-- ARENAS e QUADRAS: Todos autenticados veem, Admins gerenciam
CREATE POLICY "Public view arenas" ON public.arenas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage arenas" ON public.arenas FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

CREATE POLICY "Public view quadras" ON public.quadras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage quadras" ON public.quadras FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

-- REPLAYS: Todos autenticados veem, Admins gerenciam
CREATE POLICY "Public view replays" ON public.replays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage replays" ON public.replays FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

-- EDGE DEVICES, CAMERAS, INPUT BOARDS e SETTINGS: Apenas Admins veem e gerenciam
CREATE POLICY "Admin manage edge_devices" ON public.edge_devices FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

CREATE POLICY "Admin manage cameras" ON public.cameras FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

CREATE POLICY "Admin manage input_boards" ON public.input_boards FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

CREATE POLICY "Admin manage arena_settings" ON public.arena_settings FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

-- PROFILES: Usuário vê o próprio, Admins veem todos
CREATE POLICY "Profiles view" ON public.profiles FOR SELECT TO authenticated 
USING (id = auth.uid() OR is_super_admin = true OR is_arena_owner = true);

CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE TO authenticated 
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles admin manage" ON public.profiles FOR ALL TO authenticated 
USING (is_super_admin = true) WITH CHECK (is_super_admin = true);
