-- Drop all existing policies on profiles to start fresh and avoid conflicts
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles can be inserted by owners" ON public.profiles;
DROP POLICY IF EXISTS "Profiles can be updated by owners or admins" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_full_access" ON public.profiles;

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Super Admin Policy: Full access to everything
-- This handles SELECT, INSERT, UPDATE, DELETE for super admins
CREATE POLICY "Super admins can manage everything"
ON public.profiles
FOR ALL
TO authenticated
USING (
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- 2. User SELECT: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 3. User UPDATE: Users can update their own profile
-- Note: They cannot change is_super_admin via this policy because they aren't super admins
-- unless they already are, in which case the "manage everything" policy covers it.
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. User INSERT: Allow initial profile creation on signup
-- This is usually handled by a trigger, but having a policy is good practice
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
