-- Remover políticas problemáticas que causam recursão
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage profiles" ON public.profiles;

-- Criar política de leitura simples para evitar recursão
CREATE POLICY "Public profiles are viewable" 
ON public.profiles FOR SELECT 
USING (true);

-- Criar política de gerenciamento baseada no próprio usuário (evita recursão)
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Criar política para Super Admins baseada em uma verificação que não consulte a própria tabela via RLS
-- (O Supabase lida melhor com verificações diretas)
CREATE POLICY "Super admins manage all profiles" 
ON public.profiles FOR ALL 
USING (
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- Resetar permissões para Arenas para garantir que estão funcionando sem recursão
DROP POLICY IF EXISTS "Super admins can insert arenas" ON public.arenas;
DROP POLICY IF EXISTS "Super admins can update arenas" ON public.arenas;
DROP POLICY IF EXISTS "Super admins can delete arenas" ON public.arenas;

CREATE POLICY "Super admins insert arenas" ON public.arenas FOR INSERT WITH CHECK ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);
CREATE POLICY "Super admins update arenas" ON public.arenas FOR UPDATE USING ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);
CREATE POLICY "Super admins delete arenas" ON public.arenas FOR DELETE USING ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);
