-- 1. Atualiza trigger de novo usuário para capturar CPF, nome, data de nascimento
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, cpf, birth_date,
    consent_accepted, consent_timestamp, role
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
    COALESCE((NEW.raw_user_meta_data->>'consent_timestamp')::timestamptz, now()),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Garante o trigger em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Tabela de logs de atividade
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,             -- login, logout, download_replay, share_replay, admin_create, admin_update, admin_delete
  resource_type text,               -- replay, arena, quadra, camera, edge_device, user, etc
  resource_id uuid,
  arena_id uuid REFERENCES public.arenas(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user ON public.user_activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON public.user_activity_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_arena ON public.user_activity_logs(arena_id, created_at DESC);

GRANT SELECT, INSERT ON public.user_activity_logs TO authenticated;
GRANT ALL ON public.user_activity_logs TO service_role;

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Usuário pode inserir logs de suas próprias ações
CREATE POLICY "users_insert_own_logs" ON public.user_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Usuário vê os próprios logs
CREATE POLICY "users_read_own_logs" ON public.user_activity_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Super admin vê tudo; arena_owner vê logs da sua arena
CREATE POLICY "admin_read_logs" ON public.user_activity_logs
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      arena_id IS NOT NULL
      AND arena_id = (SELECT arena_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT is_arena_owner FROM public.profiles WHERE id = auth.uid()) = true
    )
  );

-- 3. RPC pra registrar log com segurança (SECURITY DEFINER, pega auth.uid())
CREATE OR REPLACE FUNCTION public.log_user_action(
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id uuid DEFAULT NULL,
  p_arena_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  INSERT INTO public.user_activity_logs(user_id, action, resource_type, resource_id, arena_id, metadata)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_arena_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_user_action(text, text, uuid, uuid, jsonb) TO authenticated;

-- 4. Reativa RLS em replays e força login para ver vídeos
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "replays_public_read" ON public.replays;
DROP POLICY IF EXISTS "authenticated_read_replays" ON public.replays;
CREATE POLICY "authenticated_read_replays" ON public.replays
  FOR SELECT TO authenticated USING (true);

-- Service role já bypassa; endpoints do Edge usam service_role
DROP POLICY IF EXISTS "service_role_all_replays" ON public.replays;
CREATE POLICY "service_role_all_replays" ON public.replays
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin gerencia
DROP POLICY IF EXISTS "admin_manage_replays" ON public.replays;
CREATE POLICY "admin_manage_replays" ON public.replays
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_arena_manager(auth.uid()))
  WITH CHECK (public.is_super_admin() OR public.is_arena_manager(auth.uid()));

-- Revoga qualquer SELECT anon anterior
REVOKE SELECT ON public.replays FROM anon;

-- 5. Arenas e quadras: manter leitura pública dos nomes para o filtro
--    (a home mostra "escolha sua arena" antes do login)
GRANT SELECT ON public.arenas TO anon;
GRANT SELECT ON public.quadras TO anon;

-- 6. RPC admin: listar usuários (super_admin vê todos; arena_owner vê a arena dele)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid, email text, full_name text, cpf text,
  arena_id uuid, arena_nome text, role text,
  is_super_admin boolean, is_arena_owner boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_arena_manager(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.cpf,
         p.arena_id, a.nome AS arena_nome, p.role,
         p.is_super_admin, p.is_arena_owner, p.created_at
  FROM public.profiles p
  LEFT JOIN public.arenas a ON a.id = p.arena_id
  WHERE public.is_super_admin()
     OR p.arena_id = (SELECT arena_id FROM public.profiles WHERE id = auth.uid())
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- 7. RPC admin: excluir usuário (só super_admin)
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;