
-- Extend profiles with social/user profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS favorite_sports text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_arenas uuid[] NOT NULL DEFAULT '{}';

-- Allow any authenticated user to view basic profiles (needed for public profile pages)
DROP POLICY IF EXISTS "Profiles public view" ON public.profiles;
CREATE POLICY "Profiles public view"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Link replays to owning user (nullable; edge devices may set later via a claim flow)
ALTER TABLE public.replays
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_replays_user_id ON public.replays(user_id);

-- Storage policies for avatars stored under the public "arenas" bucket at path avatars/<user_id>/*
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'arenas'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'arenas'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'arenas'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
