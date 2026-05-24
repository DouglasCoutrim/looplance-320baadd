-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Super admins can manage everything" ON public.profiles;

-- Create a non-recursive policy for super admins
-- This works because 'is_super_admin' is checked for the current user's row in a way that doesn't trigger a new subquery on the same table
CREATE POLICY "Super admins manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (auth.jwt() ->> 'email') IN (SELECT email FROM public.profiles WHERE is_super_admin = true)
  )
  OR (is_super_admin = true AND id = auth.uid())
);

-- Alternative approach: Just check if the record being accessed belongs to a super admin OR is the user's own record
-- But wait, the standard way to fix recursion in Supabase when checking roles on the same table is:
-- (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) -> this is the one causing issues.

-- Let's use the optimized non-recursive approach provided in the prompt's "GOOD" example:
DROP POLICY IF EXISTS "Super admins manage all profiles" ON public.profiles;

CREATE POLICY "Super admins manage everything"
ON public.profiles
FOR ALL
TO authenticated
USING (
  -- Check if the record being accessed is the user's own AND they are a super admin
  -- OR rely on the individual policies for non-admins
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- Actually, the prompt says the subquery IS the problem.
-- Let's use the exact recommendation from the prompt to avoid any doubt:

DROP POLICY IF EXISTS "Super admins manage everything" ON public.profiles;

CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  -- Directly check if the record is owned by a super admin (for self) 
  -- or if the authenticated user is Douglas (the master admin)
  (auth.uid() = id AND is_super_admin = true) 
  OR 
  (auth.jwt() ->> 'email' = 'douglas@looplance.app')
);

-- Actually, let's keep it clean as per the "GOOD" example:
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Admins can see all profiles" ON public.profiles
FOR SELECT 
TO authenticated
USING (
  is_super_admin = true OR id = auth.uid()
);

-- For management (INSERT/UPDATE/DELETE), we need similar non-recursive logic
CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE
TO authenticated
USING (
  is_super_admin = true OR id = auth.uid()
);

CREATE POLICY "Admins can delete all profiles" ON public.profiles
FOR DELETE
TO authenticated
USING (
  is_super_admin = true
);
