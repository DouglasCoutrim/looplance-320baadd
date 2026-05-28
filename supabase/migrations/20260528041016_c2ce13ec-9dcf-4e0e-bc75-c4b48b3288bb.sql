-- Policy for uploading (INSERT)
CREATE POLICY "Admins can upload overlays"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'overlays' AND
    (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
    ))
);

-- Policy for updating (UPDATE)
CREATE POLICY "Admins can update overlays"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'overlays' AND
    (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
    ))
);

-- Policy for deleting (DELETE)
CREATE POLICY "Admins can delete overlays"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'overlays' AND
    (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
    ))
);