
-- Suporte a transmissão híbrida RTMP/RTSP na tabela cameras
ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS stream_protocol text NOT NULL DEFAULT 'rtsp',
  ADD COLUMN IF NOT EXISTS rtmp_stream_key uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS protocol_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Restringe stream_protocol aos valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cameras_stream_protocol_check'
  ) THEN
    ALTER TABLE public.cameras
      ADD CONSTRAINT cameras_stream_protocol_check
      CHECK (stream_protocol IN ('rtmp','rtsp'));
  END IF;
END $$;

-- Garante unicidade da chave RTMP (usada na URL de ingestão pública)
CREATE UNIQUE INDEX IF NOT EXISTS cameras_rtmp_stream_key_uidx
  ON public.cameras(rtmp_stream_key);
