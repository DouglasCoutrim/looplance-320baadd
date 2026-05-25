-- Consolidando políticas para edge_devices
DROP POLICY IF EXISTS "edge_select" ON public.edge_devices;
DROP POLICY IF EXISTS "edge_insert" ON public.edge_devices;
DROP POLICY IF EXISTS "edge_update" ON public.edge_devices;
DROP POLICY IF EXISTS "Super admins manage all edge_devices" ON public.edge_devices;

CREATE POLICY "Admins manage all edge_devices" 
ON public.edge_devices 
FOR ALL 
TO authenticated 
USING (is_arena_manager(auth.uid()))
WITH CHECK (is_arena_manager(auth.uid()));

-- Consolidando políticas para cameras
DROP POLICY IF EXISTS "cameras_select" ON public.cameras;
DROP POLICY IF EXISTS "cameras_insert" ON public.cameras;
DROP POLICY IF EXISTS "cameras_update" ON public.cameras;
DROP POLICY IF EXISTS "Super admins manage all cameras" ON public.cameras;

CREATE POLICY "Admins manage all cameras" 
ON public.cameras 
FOR ALL 
TO authenticated 
USING (is_arena_manager(auth.uid()))
WITH CHECK (is_arena_manager(auth.uid()));

-- Consolidando políticas para input_boards
DROP POLICY IF EXISTS "Super admins manage all input_boards" ON public.input_boards;

CREATE POLICY "Admins manage all input_boards" 
ON public.input_boards 
FOR ALL 
TO authenticated 
USING (is_arena_manager(auth.uid()))
WITH CHECK (is_arena_manager(auth.uid()));

-- Garantindo que o perfil do administrador tenha as flags corretas (caso não tenha)
UPDATE public.profiles 
SET is_super_admin = true, role = 'super-admin'
WHERE email IN ('douglas@looplance.app', 'jorgealcino@gmail.com');
