-- Adiciona coluna de status na tabela replays para controle de estado
-- Permite registrar o replay como 'processing' antes do upload terminar
-- Frontend exibe apenas replays com status 'ready'
ALTER TABLE public.replays
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('processing', 'ready', 'failed'));

CREATE INDEX IF NOT EXISTS idx_replays_status ON public.replays(status);
