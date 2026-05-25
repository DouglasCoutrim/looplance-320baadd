-- Função auxiliar para verificar se o usuário atual é super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que super admins podem ver todos os perfis
CREATE POLICY "Super Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_super_admin());

-- Garantir que super admins podem atualizar todos os perfis
CREATE POLICY "Super Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.is_super_admin());

-- Garantir que super admins podem deletar perfis
CREATE POLICY "Super Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (public.is_super_admin());

-- Função para o admin criar um usuário (precisa ser chamada via RPC ou Edge Function)
-- Nota: Para mudar a senha ou bloquear via Auth, geralmente usamos Admin API do Supabase.
-- Como não temos a service_role key no frontend, criaremos funções seguras que usam SECURITY DEFINER.

-- Função para resetar senha (exemplo simplificado, idealmente via Edge Function)
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  user_id UUID,
  new_role TEXT,
  new_is_super_admin BOOLEAN,
  new_is_arena_owner BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.profiles
  SET 
    role = new_role,
    is_super_admin = new_is_super_admin,
    is_arena_owner = new_is_arena_owner,
    updated_at = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
