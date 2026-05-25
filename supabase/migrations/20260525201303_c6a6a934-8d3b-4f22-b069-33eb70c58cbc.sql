-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Admin manage arenas" ON public.arenas;
DROP POLICY IF EXISTS "Super admins manage all arenas" ON public.arenas;
DROP POLICY IF EXISTS "Public view arenas" ON public.arenas;

-- 1. Everyone authenticated can view arenas
CREATE POLICY "Public view arenas" 
ON public.arenas 
FOR SELECT 
TO authenticated 
USING (true);

-- 2. Super admins can do EVERYTHING
CREATE POLICY "Super admins manage all arenas" 
ON public.arenas 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_super_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_super_admin = true
  )
);

-- 3. Arena owners can manage arenas where they are owners (if we had an owner_id column)
-- For now, if the user is is_arena_owner, we allow them to manage arenas as well
-- to keep compatibility with the current logic until a specific ownership link is added.
CREATE POLICY "Arena owners manage arenas" 
ON public.arenas 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_arena_owner = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_arena_owner = true
  )
);
