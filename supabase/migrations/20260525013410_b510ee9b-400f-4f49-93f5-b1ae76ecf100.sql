-- Adicionar novos campos à tabela arenas
ALTER TABLE public.arenas 
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Criar bucket para fotos das arenas se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('arenas', 'arenas', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para o bucket 'arenas'
DROP POLICY IF EXISTS "Public view arena photos" ON storage.objects;
CREATE POLICY "Public view arena photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'arenas');

DROP POLICY IF EXISTS "Admins can upload arena photos" ON storage.objects;
CREATE POLICY "Admins can upload arena photos" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'arenas' AND 
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  ))
);

DROP POLICY IF EXISTS "Admins can update arena photos" ON storage.objects;
CREATE POLICY "Admins can update arena photos" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'arenas' AND 
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  ))
);

DROP POLICY IF EXISTS "Admins can delete arena photos" ON storage.objects;
CREATE POLICY "Admins can delete arena photos" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'arenas' AND 
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  ))
);
