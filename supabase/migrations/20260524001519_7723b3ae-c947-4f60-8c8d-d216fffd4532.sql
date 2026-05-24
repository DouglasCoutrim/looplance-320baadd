-- Allow users to read their own profile
-- This is critical for the frontend to check roles (is_super_admin, is_arena_owner)
-- We use a simpler policy to avoid any recursion issues
DROP POLICY IF EXISTS "Profiles are viewable by owners or admins" ON public.profiles;

CREATE POLICY "Users can read own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Maintain admin visibility
CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
USING (is_admin(auth.uid()));
