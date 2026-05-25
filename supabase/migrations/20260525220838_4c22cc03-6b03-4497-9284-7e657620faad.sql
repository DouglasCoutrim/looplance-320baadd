-- Update the bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'overlays';

-- Create a policy to allow public read access if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access to Overlays'
    ) THEN
        CREATE POLICY "Public Access to Overlays" 
        ON storage.objects 
        FOR SELECT 
        USING (bucket_id = 'overlays');
    END IF;
END $$;