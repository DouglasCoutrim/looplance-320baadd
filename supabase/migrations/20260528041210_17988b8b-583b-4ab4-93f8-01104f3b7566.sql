-- Drop old policies to replace them
DROP POLICY IF EXISTS "Admins can upload overlays" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update overlays" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete overlays" ON storage.objects;

-- Policy for uploading (INSERT)
CREATE POLICY "Admins can upload overlays"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'overlays' AND
    (
        public.is_super_admin() OR
        (EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_arena_owner = true
        ))
    )
);

-- Policy for updating (UPDATE)
CREATE POLICY "Admins can update overlays"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'overlays' AND
    (
        public.is_super_admin() OR
        (EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_arena_owner = true
        ))
    )
);

-- Policy for deleting (DELETE)
CREATE POLICY "Admins can delete overlays"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'overlays' AND
    (
        public.is_super_admin() OR
        (EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_arena_owner = true
        ))
    )
);