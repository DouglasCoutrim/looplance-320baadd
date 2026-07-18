-- Suporte a credenciais manuais do YouTube por arena
-- Permite que o admin preencha client_id, client_secret e refresh_token
-- diretamente no formulario, sem depender exclusivamente do fluxo OAuth.

ALTER TABLE public.arena_youtube_credentials
  ADD COLUMN IF NOT EXISTS client_id TEXT,
  ADD COLUMN IF NOT EXISTS client_secret TEXT,
  ALTER COLUMN refresh_token DROP NOT NULL;
