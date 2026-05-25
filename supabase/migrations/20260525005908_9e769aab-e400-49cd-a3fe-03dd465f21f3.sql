-- Desabilita temporariamente o gatilho para permitir a atualização administrativa
ALTER TABLE public.profiles DISABLE TRIGGER trg_prevent_role_self_elevation;

-- Promove o usuário
UPDATE public.profiles 
SET is_super_admin = true, role = 'super-admin'
WHERE email = 'douglascoutrim@gmail.com';

-- Reabilita o gatilho
ALTER TABLE public.profiles ENABLE TRIGGER trg_prevent_role_self_elevation;

-- Garante que o Douglas @ looplance também esteja como super admin
UPDATE public.profiles 
SET is_super_admin = true, role = 'super-admin'
WHERE email = 'douglas@looplance.app';

-- Ajuste na função is_arena_manager para ser mais robusta
CREATE OR REPLACE FUNCTION public.is_arena_manager(_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Se o _uid for nulo, tenta pegar o auth.uid()
  IF _uid IS NULL THEN
    _uid := auth.uid();
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = _uid 
    AND (is_super_admin = true OR is_arena_owner = true)
  );
END;
$$;
