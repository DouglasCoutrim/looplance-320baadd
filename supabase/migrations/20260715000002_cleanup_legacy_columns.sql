-- ============================================================================
-- Migration: Cleanup Legacy Columns
-- Remove is_super_admin, is_arena_owner, role de profiles
-- Atualiza RPCs que ainda referenciam essas colunas
-- ============================================================================

-- 1. Atualizar handle_new_user para não inserir role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, cpf, birth_date,
    consent_accepted, consent_timestamp
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'cpf', ''),
    CASE WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL
         AND NEW.raw_user_meta_data->>'birth_date' <> ''
         THEN (NEW.raw_user_meta_data->>'birth_date')::date
         ELSE NULL END,
    COALESCE((NEW.raw_user_meta_data->>'consent_accepted')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'consent_timestamp')::timestamptz, now())
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Atualizar admin_assign_role — parar de sincronizar colunas legadas
CREATE OR REPLACE FUNCTION public.admin_assign_role(
  p_user_id uuid, p_role public.app_role,
  p_arena_id uuid DEFAULT NULL, p_client_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    IF p_role NOT IN ('arena_user','arena_owner')
       OR p_arena_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='arena_owner' AND arena_id=p_arena_id)
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;
  INSERT INTO public.user_roles(user_id, role, arena_id, client_id, created_by)
  VALUES (p_user_id, p_role, p_arena_id, p_client_id, auth.uid())
  ON CONFLICT DO NOTHING;

  -- Apenas atualiza arena_id/client_id no profile (campos que ainda existem)
  IF p_role = 'arena_owner' OR p_role = 'arena_user' THEN
    UPDATE public.profiles SET arena_id = COALESCE(p_arena_id, arena_id) WHERE id = p_user_id;
  ELSIF p_role = 'client_owner' THEN
    UPDATE public.profiles SET client_id = p_client_id WHERE id = p_user_id;
  END IF;
END; $$;

-- 3. Atualizar admin_revoke_role — parar de sincronizar colunas legadas
CREATE OR REPLACE FUNCTION public.admin_revoke_role(
  p_user_id uuid, p_role public.app_role,
  p_arena_id uuid DEFAULT NULL, p_client_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    IF p_role NOT IN ('arena_user','arena_owner')
       OR p_arena_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='arena_owner' AND arena_id=p_arena_id)
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;
  DELETE FROM public.user_roles
   WHERE user_id = p_user_id AND role = p_role
     AND COALESCE(arena_id,'00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_arena_id,'00000000-0000-0000-0000-000000000000'::uuid)
     AND COALESCE(client_id,'00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_client_id,'00000000-0000-0000-0000-000000000000'::uuid);

  -- Sem atualização de colunas legadas (elas serão removidas)
END; $$;

-- 4. Atualizar admin_list_users — remover is_super_admin, is_arena_owner do retorno
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid, email text, full_name text, cpf text,
  arena_id uuid, arena_nome text, client_id uuid, client_nome text,
  roles jsonb,
  frozen boolean, is_banned boolean,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_super boolean := public.has_role(auth.uid(),'super_admin');
  v_owner_arenas uuid[];
BEGIN
  IF NOT v_is_super THEN
    SELECT ARRAY_AGG(ur.arena_id) INTO v_owner_arenas
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner' AND ur.arena_id IS NOT NULL;

    IF v_owner_arenas IS NULL OR array_length(v_owner_arenas,1) IS NULL THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.email, p.full_name, p.cpf,
    p.arena_id, a.nome AS arena_nome,
    p.client_id, c.nome AS client_nome,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'role', ur.role,
        'arena_id', ur.arena_id,
        'client_id', ur.client_id
      ) ORDER BY ur.role)
      FROM public.user_roles ur WHERE ur.user_id = p.id
    ), '[]'::jsonb) AS roles,
    p.frozen, p.is_banned,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.arenas a ON a.id = p.arena_id
  LEFT JOIN public.clients c ON c.id = p.client_id
  WHERE v_is_super
     OR p.id IN (
       SELECT ur.user_id FROM public.user_roles ur
       WHERE ur.arena_id = ANY(v_owner_arenas)
     )
  ORDER BY p.created_at DESC;
END; $$;

-- 5. Atualizar RLS da tabela clients para usar has_role (antes de dropar is_super_admin)
DROP POLICY IF EXISTS "Admins podem ver clientes" ON public.clients;
DROP POLICY IF EXISTS "Admins podem inserir clientes" ON public.clients;
DROP POLICY IF EXISTS "Admins podem atualizar clientes" ON public.clients;
DROP POLICY IF EXISTS "Admins podem deletar clientes" ON public.clients;

CREATE POLICY "Admins podem ver clientes"
  ON public.clients FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins podem inserir clientes"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins podem atualizar clientes"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins podem deletar clientes"
  ON public.clients FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

-- 6. Remover função is_super_admin() — usar has_role(auth.uid(), 'super_admin')
DROP FUNCTION IF EXISTS public.is_super_admin();

-- 7. Atualizar is_arena_manager para usar has_role
CREATE OR REPLACE FUNCTION public.is_arena_manager(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(COALESCE(_uid, auth.uid()),'super_admin')
      OR public.has_role(COALESCE(_uid, auth.uid()),'arena_owner');
$$;

-- 8. Remover função legada admin_update_user_profile
DROP FUNCTION IF EXISTS public.admin_update_user_profile(
  uuid, text, text, text, boolean, boolean, uuid, uuid
);

-- 9. Remover colunas legadas de profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_super_admin;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_arena_owner;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- 10. Atualizar RLS policy admin_read_logs que referenciava profiles.is_arena_owner
DROP POLICY IF EXISTS "admin_read_logs" ON public.user_activity_logs;
CREATE POLICY "admin_read_logs" ON public.user_activity_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      arena_id IS NOT NULL
      AND public.has_role(auth.uid(), 'arena_owner')
      AND arena_id IN (
        SELECT ur.arena_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
      )
    )
  );
