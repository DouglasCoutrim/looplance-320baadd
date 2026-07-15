-- ============================================================================
-- Migration: Consolidate User Roles (substitui 00001 + 00002)
--
-- Substitui as migrations quebradas:
--   20260715000001_user_roles_enhancement.sql  — ON CONFLICT com expressões (inválido)
--   20260715000002_cleanup_legacy_columns.sql  — dependia da 00001
--
-- Esta migration:
--   1. Adiciona frozen, is_banned em profiles
--   2. RPCs freeze/ban/unban/unfreeze (com sintaxe corrigida)
--   3. RPCs admin_create_arena_admin + register_arena_user (ON CONFLICT DO NOTHING)
--   4. RLS escopo arena_owner em todas as tabelas admin
--   5. handle_new_user sem coluna role
--   6. admin_assign_role / admin_revoke_role sem colunas legadas
--   7. admin_list_users sem is_super_admin/is_arena_owner
--   8. Drop is_super_admin(), colunas legadas, atualiza RLS
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. frozen e is_banned em profiles
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. RPCs: freeze / unfreeze / ban / unban
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_freeze_user(p_user_id uuid, p_arena_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NOT public.has_role(auth.uid(), 'arena_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'arena_owner' AND arena_id = p_arena_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND arena_id = p_arena_id) THEN RAISE EXCEPTION 'Usuário não pertence a esta arena'; END IF;
  END IF;
  UPDATE public.profiles SET frozen = true WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_freeze_user(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unfreeze_user(p_user_id uuid, p_arena_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NOT public.has_role(auth.uid(), 'arena_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'arena_owner' AND arena_id = p_arena_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;
  UPDATE public.profiles SET frozen = false WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_unfreeze_user(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_ban_user(p_user_id uuid, p_arena_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NOT public.has_role(auth.uid(), 'arena_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'arena_owner' AND arena_id = p_arena_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND arena_id = p_arena_id) THEN RAISE EXCEPTION 'Usuário não pertence a esta arena'; END IF;
  END IF;
  UPDATE public.profiles SET is_banned = true WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user_id uuid, p_arena_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NOT public.has_role(auth.uid(), 'arena_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'arena_owner' AND arena_id = p_arena_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;
  UPDATE public.profiles SET is_banned = false WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid, uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. RPC: admin_create_arena_admin — cria role arena_owner para um usuário
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_create_arena_admin(
  p_email text, p_password text, p_full_name text, p_arena_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT id INTO v_user_id FROM public.profiles WHERE email = p_email LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado. Crie o usuário primeiro via Admin API.'; END IF;

  INSERT INTO public.user_roles (user_id, role, arena_id, created_by)
  VALUES (v_user_id, 'arena_owner', p_arena_id, auth.uid())
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET arena_id = COALESCE(p_arena_id, arena_id) WHERE id = v_user_id;
  RETURN v_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_create_arena_admin(text, text, text, uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. RPC: register_arena_user — atribui role arena_user (QR code signup)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.register_arena_user(
  p_email text, p_password text, p_full_name text, p_cpf text, p_arena_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE email = p_email LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;

  INSERT INTO public.user_roles (user_id, role, arena_id, created_by)
  VALUES (v_user_id, 'arena_user', p_arena_id, auth.uid())
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET arena_id = COALESCE(p_arena_id, arena_id) WHERE id = v_user_id;
  RETURN v_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_arena_user(text, text, text, text, uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. RLS: arena_sponsors — escopo arena_owner
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "admin_all_arena_sponsors" ON public.arena_sponsors;
CREATE POLICY "admin_all_arena_sponsors" ON public.arena_sponsors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner')))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner')));

-- ════════════════════════════════════════════════════════════════════════════
-- 6. RLS: arenas — leitura pública, escrita só super_admin / arena_owner
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public read arenas" ON public.arenas;
CREATE POLICY "Public read arenas" ON public.arenas FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_write_arenas" ON public.arenas;
CREATE POLICY "admin_write_arenas" ON public.arenas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner')))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner')));

-- ════════════════════════════════════════════════════════════════════════════
-- 7. RLS: replays — arena_owner vê apenas replays da sua arena
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "admin_manage_replays" ON public.replays;
CREATE POLICY "admin_manage_replays" ON public.replays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner')))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner')));

-- ════════════════════════════════════════════════════════════════════════════
-- 8. RLS: quadras — leitura pública, escrita só super_admin / arena_owner
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public read quadras" ON public.quadras;
CREATE POLICY "Public read quadras" ON public.quadras FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_write_quadras" ON public.quadras;
CREATE POLICY "admin_write_quadras" ON public.quadras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner')))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner')));

-- ════════════════════════════════════════════════════════════════════════════
-- 9. RLS: cameras — arena_owner vê apenas da sua arena
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow authenticated all" ON public.cameras;
CREATE POLICY "Allow authenticated all" ON public.cameras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND quadra_id IN (SELECT q.id FROM public.quadras q WHERE q.arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'))))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND quadra_id IN (SELECT q.id FROM public.quadras q WHERE q.arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'))));

-- ════════════════════════════════════════════════════════════════════════════
-- 10. RLS: edge_devices — arena_owner vê apenas devices da sua arena
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow authenticated all" ON public.edge_devices;
CREATE POLICY "Allow authenticated all" ON public.edge_devices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner')))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner')));

-- ════════════════════════════════════════════════════════════════════════════
-- 11. RLS: input_boards — arena_owner vê apenas boards da sua arena
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow authenticated all" ON public.input_boards;
CREATE POLICY "Allow authenticated all" ON public.input_boards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND edge_device_id IN (SELECT e.id FROM public.edge_devices e WHERE e.arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'))))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'arena_owner') AND edge_device_id IN (SELECT e.id FROM public.edge_devices e WHERE e.arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner'))));

-- ════════════════════════════════════════════════════════════════════════════
-- 12. handle_new_user — sem coluna role (já foi dropada)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, cpf, birth_date, consent_accepted, consent_timestamp)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'cpf', ''),
    CASE WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL AND NEW.raw_user_meta_data->>'birth_date' <> '' THEN (NEW.raw_user_meta_data->>'birth_date')::date ELSE NULL END,
    COALESCE((NEW.raw_user_meta_data->>'consent_accepted')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'consent_timestamp')::timestamptz, now())
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 13. admin_assign_role — sem sincronizar colunas legadas
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_assign_role(
  p_user_id uuid, p_role public.app_role,
  p_arena_id uuid DEFAULT NULL, p_client_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    IF p_role NOT IN ('arena_user','arena_owner') OR p_arena_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='arena_owner' AND arena_id=p_arena_id)
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;
  INSERT INTO public.user_roles(user_id, role, arena_id, client_id, created_by)
  VALUES (p_user_id, p_role, p_arena_id, p_client_id, auth.uid())
  ON CONFLICT DO NOTHING;
  IF p_role = 'arena_owner' OR p_role = 'arena_user' THEN
    UPDATE public.profiles SET arena_id = COALESCE(p_arena_id, arena_id) WHERE id = p_user_id;
  ELSIF p_role = 'client_owner' THEN
    UPDATE public.profiles SET client_id = p_client_id WHERE id = p_user_id;
  END IF;
END; $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 14. admin_revoke_role — sem sincronizar colunas legadas
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_revoke_role(
  p_user_id uuid, p_role public.app_role,
  p_arena_id uuid DEFAULT NULL, p_client_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    IF p_role NOT IN ('arena_user','arena_owner') OR p_arena_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='arena_owner' AND arena_id=p_arena_id)
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;
  DELETE FROM public.user_roles
   WHERE user_id = p_user_id AND role = p_role
     AND COALESCE(arena_id,'00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_arena_id,'00000000-0000-0000-0000-000000000000'::uuid)
     AND COALESCE(client_id,'00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_client_id,'00000000-0000-0000-0000-000000000000'::uuid);
END; $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 15. admin_list_users — sem is_super_admin/is_arena_owner no retorno
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid, email text, full_name text, cpf text,
  arena_id uuid, arena_nome text, client_id uuid, client_nome text,
  roles jsonb, frozen boolean, is_banned boolean, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_super boolean := public.has_role(auth.uid(),'super_admin');
  v_owner_arenas uuid[];
BEGIN
  IF NOT v_is_super THEN
    SELECT ARRAY_AGG(ur.arena_id) INTO v_owner_arenas FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner' AND ur.arena_id IS NOT NULL;
    IF v_owner_arenas IS NULL OR array_length(v_owner_arenas,1) IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.cpf,
         p.arena_id, a.nome AS arena_nome, p.client_id, c.nome AS client_nome,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('role', ur.role, 'arena_id', ur.arena_id, 'client_id', ur.client_id) ORDER BY ur.role) FROM public.user_roles ur WHERE ur.user_id = p.id), '[]'::jsonb) AS roles,
         p.frozen, p.is_banned, p.created_at
  FROM public.profiles p
  LEFT JOIN public.arenas a ON a.id = p.arena_id
  LEFT JOIN public.clients c ON c.id = p.client_id
  WHERE v_is_super OR p.id IN (SELECT ur.user_id FROM public.user_roles ur WHERE ur.arena_id = ANY(v_owner_arenas))
  ORDER BY p.created_at DESC;
END; $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 16. RLS: clients — só super_admin (via has_role)
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admins podem ver clientes" ON public.clients;
DROP POLICY IF EXISTS "Admins podem inserir clientes" ON public.clients;
DROP POLICY IF EXISTS "Admins podem atualizar clientes" ON public.clients;
DROP POLICY IF EXISTS "Admins podem deletar clientes" ON public.clients;

CREATE POLICY "Admins podem ver clientes" ON public.clients FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins podem inserir clientes" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins podem atualizar clientes" ON public.clients FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins podem deletar clientes" ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- 17. Drop is_super_admin() — usar has_role(auth.uid(), 'super_admin')
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.is_super_admin();

-- ════════════════════════════════════════════════════════════════════════════
-- 18. is_arena_manager — usar has_role
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_arena_manager(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(COALESCE(_uid, auth.uid()),'super_admin') OR public.has_role(COALESCE(_uid, auth.uid()),'arena_owner');
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 19. Drop colunas legadas de profiles
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_super_admin;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_arena_owner;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- ════════════════════════════════════════════════════════════════════════════
-- 20. RLS: user_activity_logs — sem referência a profiles.is_arena_owner
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "admin_read_logs" ON public.user_activity_logs;
CREATE POLICY "admin_read_logs" ON public.user_activity_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR (arena_id IS NOT NULL AND public.has_role(auth.uid(), 'arena_owner') AND arena_id IN (SELECT ur.arena_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'arena_owner')));
