-- Add role column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
    END IF;
END $$;

-- Migrate existing flags
UPDATE public.profiles SET role = 'super-admin' WHERE is_super_admin = true;
UPDATE public.profiles SET role = 'arena-owner' WHERE is_arena_owner = true AND (is_super_admin IS NULL OR is_super_admin = false);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Ensure RLS allows reading own profile (including role)
-- The user already has "Users can read own profile" policy, but we make sure.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can read own profile'
    ) THEN
        CREATE POLICY "Users can read own profile" 
        ON public.profiles 
        FOR SELECT 
        USING (auth.uid() = id);
    END IF;
END $$;
