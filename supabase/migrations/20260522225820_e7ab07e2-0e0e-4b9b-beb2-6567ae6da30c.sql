
CREATE TABLE public.arenas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.quadras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quadra_id UUID NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quadras_arena ON public.quadras(arena_id);
CREATE INDEX idx_replays_quadra ON public.replays(quadra_id);
CREATE INDEX idx_replays_created ON public.replays(created_at DESC);

ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read arenas" ON public.arenas FOR SELECT USING (true);
CREATE POLICY "Public read quadras" ON public.quadras FOR SELECT USING (true);
CREATE POLICY "Public read replays" ON public.replays FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.replays;
ALTER TABLE public.replays REPLICA IDENTITY FULL;

-- Seed demo data
INSERT INTO public.arenas (id, nome) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Arena Central'),
  ('22222222-2222-2222-2222-222222222222', 'Arena Beach Club');

INSERT INTO public.quadras (id, arena_id, nome) VALUES
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Quadra 1'),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Quadra 2'),
  ('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Quadra Areia 1');
