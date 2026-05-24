-- Garantir que o RLS está habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar conflitos (opcional, mas garante limpeza)
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins delete profiles" ON public.profiles;

-- Política para leitura: Usuário vê a própria linha OU admin vê tudo
CREATE POLICY "Profiles are viewable by owners or admins"
ON public.profiles
FOR SELECT
USING (auth.uid() = id OR is_admin(auth.uid()));

-- Política para atualização: Usuário edita a própria linha OU admin edita tudo
CREATE POLICY "Profiles can be updated by owners or admins"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id OR is_admin(auth.uid()))
WITH CHECK (auth.uid() = id OR is_admin(auth.uid()));

-- Política para inserção: Usuário pode criar o próprio perfil
CREATE POLICY "Profiles can be inserted by owners"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Garantir que as funções auxiliares não falhem se chamadas sem auth
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = _uid),
    false
  );
$function$;
