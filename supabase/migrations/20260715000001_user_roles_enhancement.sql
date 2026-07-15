-- ============================================================================
-- Migration: User Roles Enhancement
-- 1. is_banned em profiles
-- 2. RPCs: freeze/ban/unban/unfreeze, create_arena_admin
-- 3. RLS: arena_sponsors escopo arena_owner
-- 4. handle_new_user suporta arena_id via metadata
-- ============================================================================

-- 1. frozen e is_banned em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- 2. RPC: admin_freeze_user — arena admin marca usuário como congelado
CREATE OR REPLACE FUNCTION public.admin_freeze_user(p_user_id uuid, p_arena_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NOT public.has_role(auth.uid(), 'arena_owner') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'arena_owner' AND arena_id = p_arena_id) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND arena_id = p_arena_id) THEN
      RAISE EXCEPTION 'Usuário não pertence a esta arena';
    END IF;
  END IF;
  UPDATE public.profiles SET frozen = true WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_freeze_user(uuid, uuid) TO authenticated;

-- 3. RPC: admin_unfreeze_user
CREATE OR REPLACE FUNCTION public.admin_unfreeze_user(p_user_id uuid, p_arena_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NOT public.has_role(auth.uid(), 'arena_owner') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'arena_owner' AND arena_id = p_arena_id) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;
  UPDATE public.profiles SET frozen = false WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_unfreeze_user(uuid, uuid) TO authenticated;

-- 4. RPC: admin_ban_user
CREATE OR REPLACE FUNCTION public.admin_ban_user(p_user_id uuid, p_arena_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NOT public.has_role(auth.uid(), 'arena_owner') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'arena_owner' AND arena_id = p_arena_id) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND arena_id = p_arena_id) THEN
      RAISE EXCEPTION 'Usuário não pertence a esta arena';
    END IF;
  END IF;
  UPDATE public.profiles SET is_banned = true WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, uuid) TO authenticated;

-- 5. RPC: admin_unban_user
CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user_id uuid, p_arena_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NOT public.has_role(auth.uid(), 'arena_owner') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'arena_owner' AND arena_id = p_arena_id) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;
  UPDATE public.profiles SET is_banned = false WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid, uuid) TO authenticated;

-- 6. RPC: admin_create_arena_admin — super admin cria usuário com senha + já atribui arena_owner
CREATE OR REPLACE FUNCTION public.admin_create_arena_admin(
  p_email text,
  p_password text,
  p_full_name text,
  p_arena_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Cria usuário no auth.users via Supabase Admin API (chamado do backend)
  -- Esta função é chamada pelo server function createArenaAdmin, não diretamente
  -- Ela apenas valida e prepara a atribuição de role

  -- Verifica se o usuário já existe
  SELECT id INTO v_user_id FROM public.profiles WHERE email = p_email LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado. Crie o usuário primeiro via Admin API.';
  END IF;

  -- Atribui role arena_owner
  INSERT INTO public.user_roles (user_id, role, arena_id, created_by)
  VALUES (v_user_id, 'arena_owner', p_arena_id, auth.uid())
  ON CONFLICT (user_id, role, COALESCE(arena_id,'00000000-0000-0000-0000-000000000000'::uuid), COALESCE(client_id,'00000000-0000-0000-0000-000000000000'::uuid))
  DO NOTHING;

  -- Sincroniza profiles
  UPDATE public.profiles
     SET arena_id = COALESCE(p_arena_id, arena_id)
   WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_arena_admin(text, text, text, uuid) TO authenticated;

-- 7. RPC: register_arena_user — cria usuário com role arena_user (usado no cadastro via QR code)
CREATE OR REPLACE FUNCTION public.register_arena_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_cpf text,
  p_arena_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Esta função é chamada pelo server function registerArenaUser
  -- O usuário já foi criado no auth.users via Admin API
  -- Aqui apenas atribuímos a role

  SELECT id INTO v_user_id FROM public.profiles WHERE email = p_email LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Atribui role arena_user
  INSERT INTO public.user_roles (user_id, role, arena_id, created_by)
  VALUES (v_user_id, 'arena_user', p_arena_id, auth.uid())
  ON CONFLICT (user_id, role, COALESCE(arena_id,'00000000-0000-0000-0000-000000000000'::uuid), COALESCE(client_id,'00000000-0000-0000-0000-000000000000'::uuid))
  DO NOTHING;

  -- Sincroniza arena_id no profile
  UPDATE public.profiles
     SET arena_id = COALESCE(p_arena_id, arena_id)
   WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_arena_user(text, text, text, text, uuid) TO authenticated;

-- 8. Atualizar RLS arena_sponsors para permitir arena_owner
DROP POLICY IF EXISTS "admin_all_arena_sponsors" ON public.arena_sponsors;
CREATE POLICY "admin_all_arena_sponsors" ON public.arena_sponsors
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND arena_id IN (
        SELECT ur.arena_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND arena_id IN (
        SELECT ur.arena_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
      )
    )
  );

-- 9. RLS para arenas: arena_owner vê apenas suas arenas em operações de escrita
DROP POLICY IF EXISTS "Public read arenas" ON public.arenas;
CREATE POLICY "Public read arenas" ON public.arenas FOR SELECT USING (true);

-- Mantém apenas super_admin e arena_owner com permissão de escrita em arenas
-- (já que authenticated tem permissão via GRANT, precisamos de uma política restrictiva)
DROP POLICY IF EXISTS "admin_write_arenas" ON public.arenas;
CREATE POLICY "admin_write_arenas" ON public.arenas
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND id IN (
        SELECT ur.arena_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND id IN (
        SELECT ur.arena_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
      )
    )
  );

-- 10. RLS para replays: arena_owner vê apenas replays da sua arena
DROP POLICY IF EXISTS "admin_manage_replays" ON public.replays;
CREATE POLICY "admin_manage_replays" ON public.replays
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND arena_id IN (
        SELECT ur.arena_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND arena_id IN (
        SELECT ur.arena_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
      )
    )
  );

-- 11. RLS para quadras: arena_owner vê apenas quadras da sua arena
DROP POLICY IF EXISTS "Public read quadras" ON public.quadras;
CREATE POLICY "Public read quadras" ON public.quadras FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_write_quadras" ON public.quadras;
CREATE POLICY "admin_write_quadras" ON public.quadras
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND arena_id IN (
        SELECT ur.arena_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND arena_id IN (
        SELECT ur.arena_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
      )
    )
  );

-- 12. RLS para cameras: arena_owner vê apenas cameras da sua arena
DROP POLICY IF EXISTS "Allow authenticated all" ON public.cameras;
CREATE POLICY "Allow authenticated all" ON public.cameras FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND quadra_id IN (
        SELECT q.id FROM public.quadras q
        WHERE q.arena_id IN (
          SELECT ur.arena_id FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
        )
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND quadra_id IN (
        SELECT q.id FROM public.quadras q
        WHERE q.arena_id IN (
          SELECT ur.arena_id FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
        )
      )
    )
  );

-- 13. RLS para edge_devices: arena_owner vê apenas devices da sua arena
DROP POLICY IF EXISTS "Allow authenticated all" ON public.edge_devices;
CREATE POLICY "Allow authenticated all" ON public.edge_devices FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND arena_id IN (
        SELECT ur.arena_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND arena_id IN (
        SELECT ur.arena_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
      )
    )
  );

-- 14. Atualizar admin_list_users para incluir frozen e is_banned
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid, email text, full_name text, cpf text,
  arena_id uuid, arena_nome text, client_id uuid, client_nome text,
  roles jsonb, is_super_admin boolean, is_arena_owner boolean,
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
    p.is_super_admin, p.is_arena_owner, p.frozen, p.is_banned,
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

-- 15. RLS para input_boards: arena_owner vê apenas boards da sua arena
DROP POLICY IF EXISTS "Allow authenticated all" ON public.input_boards;
CREATE POLICY "Allow authenticated all" ON public.input_boards FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND edge_device_id IN (
        SELECT e.id FROM public.edge_devices e
        WHERE e.arena_id IN (
          SELECT ur.arena_id FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
        )
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'arena_owner')
      AND edge_device_id IN (
        SELECT e.id FROM public.edge_devices e
        WHERE e.arena_id IN (
          SELECT ur.arena_id FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'
        )
      )
    )
  );

-- 15. RLS para clients: super_admin apenas (mantido)
-- Nada muda para clients — só super_admin vê/gerencia
