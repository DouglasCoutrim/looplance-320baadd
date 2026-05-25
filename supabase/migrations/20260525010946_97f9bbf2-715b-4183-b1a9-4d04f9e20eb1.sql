-- Remove a política antiga que dependia da função is_arena_manager que pode estar falhando
DROP POLICY IF EXISTS "Admins manage all edge_devices" ON public.edge_devices;

-- Cria uma nova política baseada diretamente nas colunas da tabela profiles
CREATE POLICY "Super admins and owners manage edge_devices" 
ON public.edge_devices 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  )
);

-- Faz o mesmo para as outras tabelas administrativas para evitar erros similares
DROP POLICY IF EXISTS "Admins manage all cameras" ON public.cameras;
CREATE POLICY "Super admins and owners manage cameras" 
ON public.cameras 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  )
);

DROP POLICY IF EXISTS "Admins manage all input_boards" ON public.input_boards;
CREATE POLICY "Super admins and owners manage input_boards" 
ON public.input_boards 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  )
);
