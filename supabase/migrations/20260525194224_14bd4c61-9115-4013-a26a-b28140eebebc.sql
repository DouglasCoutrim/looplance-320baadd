-- Corrigindo is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Corrigindo admin_update_user_profile
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revogar execução pública e conceder apenas para usuários autenticados
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_update_user_profile(UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_profile(UUID, TEXT, BOOLEAN, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(UUID, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
