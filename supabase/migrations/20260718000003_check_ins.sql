-- Migration: Check-in nas arenas
-- Permite que usuarios facam check-in numa quadra para filtrar o feed
-- e iniciar transmissao ao vivo.

CREATE TABLE public.check_ins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  quadra_id UUID NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- Cada usuario pode ter no maximo um check-in ativo
CREATE UNIQUE INDEX check_ins_active_unique ON public.check_ins (user_id) WHERE active = true;

-- Policies
CREATE POLICY "check_ins_select_own"
  ON public.check_ins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "check_ins_insert_own"
  ON public.check_ins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "check_ins_update_own"
  ON public.check_ins FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "check_ins_delete_own"
  ON public.check_ins FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indices
CREATE INDEX check_ins_user_active_idx ON public.check_ins (user_id) WHERE active = true;
CREATE INDEX check_ins_quadra_idx ON public.check_ins (quadra_id);

ALTER TABLE public.check_ins REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.check_ins;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;

-- Adiciona scheduled_end_time para limitar duracao da live a 1h
ALTER TABLE public.live_broadcasts ADD COLUMN IF NOT EXISTS scheduled_end_time TIMESTAMPTZ;
