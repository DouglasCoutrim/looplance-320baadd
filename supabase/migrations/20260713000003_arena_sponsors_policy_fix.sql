-- Garante que a tabela arena_sponsors tenha RLS e policies corretas
-- (mesmo padrao das demais tabelas admin: replays, arenas, etc.)

ALTER TABLE public.arena_sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_arena_sponsors" ON public.arena_sponsors;
DROP POLICY IF EXISTS "service_role_read_arena_sponsors" ON public.arena_sponsors;

-- Admin gerencia (mesmo padrao: is_super_admin OU is_arena_manager)
CREATE POLICY "admin_all_arena_sponsors" ON public.arena_sponsors
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_arena_manager(auth.uid()))
  WITH CHECK (public.is_super_admin() OR public.is_arena_manager(auth.uid()));

-- Edge device le os ativos (via service_role no backend)
CREATE POLICY "service_role_read_arena_sponsors" ON public.arena_sponsors
  FOR SELECT TO service_role
  USING (true);
