-- RTMP Protocol Support for Cameras
--
-- Adiciona suporte a streaming via RTMP + HLS nas câmeras,
-- permitindo que cada câmera seja configurada com protocolo
-- 'rtmp' (ingestão direta no Nginx) ou 'rtsp' (relay via Edge Agent).

-- 1. Novas colunas na tabela cameras
ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS stream_protocol TEXT NOT NULL DEFAULT 'rtsp'
    CHECK (stream_protocol IN ('rtmp', 'rtsp'));

ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS rtmp_stream_key TEXT UNIQUE;

ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS protocol_settings JSONB DEFAULT '{}'::jsonb;

-- 2. Trigger para gerar rtmp_stream_key automaticamente
CREATE OR REPLACE FUNCTION public.fn_generate_rtmp_stream_key()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stream_protocol = 'rtmp' AND NEW.rtmp_stream_key IS NULL THEN
    NEW.rtmp_stream_key := gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cameras_generate_rtmp_key ON public.cameras;
CREATE TRIGGER trg_cameras_generate_rtmp_key
  BEFORE INSERT OR UPDATE OF stream_protocol ON public.cameras
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_generate_rtmp_stream_key();

-- 3. Índice para busca por rtmp_stream_key (usado na autenticação da ingestão)
CREATE INDEX IF NOT EXISTS idx_cameras_rtmp_stream_key ON public.cameras(rtmp_stream_key);
