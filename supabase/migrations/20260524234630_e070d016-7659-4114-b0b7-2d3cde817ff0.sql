-- Update the security function to be more robust and use our boolean flags
CREATE OR REPLACE FUNCTION public.is_arena_manager(_uid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = _uid 
    AND (is_super_admin = true OR is_arena_owner = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply policies for all tables to ensure consistency with the new logic
-- This assumes we want super admins to have full control and owners to have manager control

-- Tables to update: cameras, edge_devices, input_boards, arena_settings, arenas, quadras, replays

-- 1. CAMERAS
DROP POLICY IF EXISTS "Admins read cameras" ON public.cameras;
DROP POLICY IF EXISTS "Admins manage cameras" ON public.cameras;
CREATE POLICY "Super admins manage all cameras" ON public.cameras FOR ALL TO authenticated USING (public.is_arena_manager(auth.uid()));

-- 2. EDGE DEVICES
DROP POLICY IF EXISTS "Admins read edge_devices" ON public.edge_devices;
DROP POLICY IF EXISTS "Admins manage edge_devices" ON public.edge_devices;
CREATE POLICY "Super admins manage all edge_devices" ON public.edge_devices FOR ALL TO authenticated USING (public.is_arena_manager(auth.uid()));

-- 3. INPUT BOARDS
DROP POLICY IF EXISTS "Admins read input_boards" ON public.input_boards;
DROP POLICY IF EXISTS "Admins manage input_boards" ON public.input_boards;
CREATE POLICY "Super admins manage all input_boards" ON public.input_boards FOR ALL TO authenticated USING (public.is_arena_manager(auth.uid()));

-- 4. ARENA SETTINGS
DROP POLICY IF EXISTS "Public read arena_settings" ON public.arena_settings;
DROP POLICY IF EXISTS "Admins manage arena_settings" ON public.arena_settings;
CREATE POLICY "Public can view arena settings" ON public.arena_settings FOR SELECT USING (true);
CREATE POLICY "Super admins manage all arena_settings" ON public.arena_settings FOR ALL TO authenticated USING (public.is_arena_manager(auth.uid()));

-- 5. ARENAS
DROP POLICY IF EXISTS "Public read arenas" ON public.arenas;
DROP POLICY IF EXISTS "Admins manage arenas" ON public.arenas;
CREATE POLICY "Public can view arenas" ON public.arenas FOR SELECT USING (true);
CREATE POLICY "Super admins manage all arenas" ON public.arenas FOR ALL TO authenticated USING (public.is_arena_manager(auth.uid()));

-- 6. QUADRAS
DROP POLICY IF EXISTS "Public read quadras" ON public.quadras;
DROP POLICY IF EXISTS "Admins manage quadras" ON public.quadras;
CREATE POLICY "Public can view quadras" ON public.quadras FOR SELECT USING (true);
CREATE POLICY "Super admins manage all quadras" ON public.quadras FOR ALL TO authenticated USING (public.is_arena_manager(auth.uid()));

-- 7. REPLAYS
DROP POLICY IF EXISTS "Public read replays" ON public.replays;
DROP POLICY IF EXISTS "Admins manage replays" ON public.replays;
CREATE POLICY "Public can view replays" ON public.replays FOR SELECT USING (true);
CREATE POLICY "Super admins manage all replays" ON public.replays FOR ALL TO authenticated USING (public.is_arena_manager(auth.uid()));
