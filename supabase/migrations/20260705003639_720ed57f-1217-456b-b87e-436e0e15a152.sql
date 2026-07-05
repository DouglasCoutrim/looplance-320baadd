ALTER TABLE public.quadras
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD CONSTRAINT quadras_tipo_chk CHECK (tipo IS NULL OR tipo IN ('grama','sintetico','areia','terra','cimento'));