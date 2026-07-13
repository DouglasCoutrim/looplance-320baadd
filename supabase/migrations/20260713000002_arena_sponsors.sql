-- Cria tabela de patrocinadores por arena (até 6 logos)
CREATE TABLE IF NOT EXISTS public.arena_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  logo_url TEXT NOT NULL,
  position_index INTEGER NOT NULL CHECK (position_index BETWEEN 1 AND 6),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (arena_id, position_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_sponsors_arena
  ON public.arena_sponsors(arena_id)
  WHERE is_active = true;

ALTER TABLE public.arena_sponsors ENABLE ROW LEVEL SECURITY;

-- Admin pode tudo
CREATE POLICY "admin_all_arena_sponsors" ON public.arena_sponsors
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_arena_manager(auth.uid()))
  WITH CHECK (public.is_super_admin() OR public.is_arena_manager(auth.uid()));

-- Edge device lê os ativos (via service_role no backend)
CREATE POLICY "service_role_read_arena_sponsors" ON public.arena_sponsors
  FOR SELECT TO service_role
  USING (true);
