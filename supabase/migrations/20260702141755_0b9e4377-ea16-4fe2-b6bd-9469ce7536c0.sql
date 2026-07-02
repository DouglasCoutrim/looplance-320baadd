
-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin','client_owner','arena_owner','arena_user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. profiles: link a cliente PJ
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- 3. user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  arena_id uuid REFERENCES public.arenas(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique_scope_idx
  ON public.user_roles (
    user_id, role,
    COALESCE(arena_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(client_id,'00000000-0000-0000-0000-000000000000'::uuid)
  );

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

DROP POLICY IF EXISTS "user_roles_self_read" ON public.user_roles;
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL
  TO authenticated USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- Backfill
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM public.profiles WHERE is_super_admin = true
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role, arena_id)
SELECT id, 'arena_owner'::public.app_role, arena_id FROM public.profiles
WHERE is_arena_owner = true AND arena_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role, arena_id)
SELECT id, 'arena_user'::public.app_role, arena_id FROM public.profiles
WHERE (is_super_admin IS NOT TRUE) AND (is_arena_owner IS NOT TRUE) AND arena_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Listagem
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid, email text, full_name text, cpf text,
  arena_id uuid, arena_nome text, client_id uuid, client_nome text,
  roles jsonb, is_super_admin boolean, is_arena_owner boolean,
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
    p.is_super_admin, p.is_arena_owner,
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

-- Assign / Revoke
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

  IF p_role = 'super_admin' THEN
    UPDATE public.profiles SET is_super_admin = true WHERE id = p_user_id;
  ELSIF p_role = 'arena_owner' THEN
    UPDATE public.profiles SET is_arena_owner = true, arena_id = COALESCE(p_arena_id, arena_id) WHERE id = p_user_id;
  ELSIF p_role = 'arena_user' AND p_arena_id IS NOT NULL THEN
    UPDATE public.profiles SET arena_id = p_arena_id WHERE id = p_user_id;
  ELSIF p_role = 'client_owner' AND p_client_id IS NOT NULL THEN
    UPDATE public.profiles SET client_id = p_client_id WHERE id = p_user_id;
  END IF;
END; $$;

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

  IF p_role = 'super_admin' THEN
    UPDATE public.profiles SET is_super_admin = false WHERE id = p_user_id;
  ELSIF p_role = 'arena_owner' THEN
    UPDATE public.profiles SET is_arena_owner = false WHERE id = p_user_id;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_arena_manager(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(COALESCE(_uid, auth.uid()),'super_admin')
      OR public.has_role(COALESCE(_uid, auth.uid()),'arena_owner');
$$;
