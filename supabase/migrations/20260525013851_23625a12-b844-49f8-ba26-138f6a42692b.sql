-- Garante que a política de INSERT e UPDATE esteja correta para o storage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Admins can update arena photos'
    ) THEN
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
    END IF;
END $$;
