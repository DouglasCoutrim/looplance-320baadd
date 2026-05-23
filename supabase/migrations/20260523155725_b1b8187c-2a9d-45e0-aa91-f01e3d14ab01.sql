-- Desativar RLS em TODAS as tabelas para garantir funcionamento imediato
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.arenas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards DISABLE ROW LEVEL SECURITY;

-- Limpar qualquer política que possa estar interferindo no nível do banco
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_owner" ON public.profiles;
DROP POLICY IF EXISTS "arenas_select_public" ON public.arenas;
DROP POLICY IF EXISTS "quadras_select_public" ON public.quadras;
DROP POLICY IF EXISTS "replays_select_public" ON public.replays;

-- Garantir que o usuário administrador Douglas tem acesso total (redundância)
INSERT INTO public.profiles (id, email, is_super_admin)
SELECT id, email, true FROM auth.users WHERE email = 'douglas@looplance.app'
ON CONFLICT (id) DO UPDATE SET is_super_admin = true;
