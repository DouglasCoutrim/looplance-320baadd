-- Desabilitar RLS temporariamente para limpar o estado
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.arenas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays DISABLE ROW LEVEL SECURITY;

-- Limpar TODAS as políticas existentes para evitar lixo
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Arenas are viewable by everyone" ON public.arenas;
DROP POLICY IF EXISTS "Super admins can manage arenas" ON public.arenas;
DROP POLICY IF EXISTS "Super admins insert arenas" ON public.arenas;
DROP POLICY IF EXISTS "Super admins update arenas" ON public.arenas;
DROP POLICY IF EXISTS "Super admins delete arenas" ON public.arenas;
DROP POLICY IF EXISTS "Quadras are viewable by everyone" ON public.quadras;
DROP POLICY IF EXISTS "Super admins can manage quadras" ON public.quadras;
DROP POLICY IF EXISTS "Public read" ON public.replays;
DROP POLICY IF EXISTS "Super admins can manage replays" ON public.replays;

-- Habilitar RLS novamente
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para PROFILES (A mais crítica para evitar recursão)
-- Leitura pública para todos
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT USING (true);
-- Atualização: apenas o dono ou se for admin (usando verificação direta do auth.uid)
CREATE POLICY "profiles_update_owner" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Políticas para ARENAS
CREATE POLICY "arenas_select_public" ON public.arenas FOR SELECT USING (true);
CREATE POLICY "arenas_all_admin" ON public.arenas FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

-- 3. Políticas para QUADRAS
CREATE POLICY "quadras_select_public" ON public.quadras FOR SELECT USING (true);
CREATE POLICY "quadras_all_admin" ON public.quadras FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

-- 4. Políticas para REPLAYS
CREATE POLICY "replays_select_public" ON public.replays FOR SELECT USING (true);
CREATE POLICY "replays_all_admin" ON public.replays FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

-- 5. Outras tabelas auxiliares
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.cameras;
CREATE POLICY "cameras_select_public" ON public.cameras FOR SELECT USING (true);
CREATE POLICY "cameras_all_admin" ON public.cameras FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true));

ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.edge_devices;
CREATE POLICY "edge_devices_select_public" ON public.edge_devices FOR SELECT USING (true);
CREATE POLICY "edge_devices_all_admin" ON public.edge_devices FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true));

ALTER TABLE public.input_boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.input_boards;
CREATE POLICY "input_boards_select_public" ON public.input_boards FOR SELECT USING (true);
CREATE POLICY "input_boards_all_admin" ON public.input_boards FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true));
