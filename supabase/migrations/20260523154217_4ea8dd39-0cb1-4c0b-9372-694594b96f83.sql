-- Garantir que as tabelas têm RLS habilitado
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para evitar conflitos (opcional, mas seguro para resetar)
DROP POLICY IF EXISTS "Arenas are viewable by everyone" ON public.arenas;
DROP POLICY IF EXISTS "Super admins can manage arenas" ON public.arenas;
DROP POLICY IF EXISTS "Quadras are viewable by everyone" ON public.quadras;
DROP POLICY IF EXISTS "Super admins can manage quadras" ON public.quadras;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Políticas para ARENAS
CREATE POLICY "Arenas are viewable by everyone" 
ON public.arenas FOR SELECT USING (true);

CREATE POLICY "Super admins can insert arenas" 
ON public.arenas FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Super admins can update arenas" 
ON public.arenas FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Super admins can delete arenas" 
ON public.arenas FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

-- Políticas para QUADRAS
CREATE POLICY "Quadras are viewable by everyone" 
ON public.quadras FOR SELECT USING (true);

CREATE POLICY "Super admins can manage quadras" 
ON public.quadras FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

-- Políticas para PROFILES
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Super admins can manage profiles" 
ON public.profiles FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

-- Garantir que outras tabelas sigam o mesmo padrão de Super Admin
CREATE POLICY "Super admins can manage cameras" ON public.cameras FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true));
CREATE POLICY "Super admins can manage edge_devices" ON public.edge_devices FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true));
CREATE POLICY "Super admins can manage input_boards" ON public.input_boards FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true));
CREATE POLICY "Super admins can manage replays" ON public.replays FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true));

-- Adicionar permissão de SELECT para todos em todas as tabelas (Leitura pública)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cameras' AND policyname = 'Public read') THEN
    CREATE POLICY "Public read" ON public.cameras FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edge_devices' AND policyname = 'Public read') THEN
    CREATE POLICY "Public read" ON public.edge_devices FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'input_boards' AND policyname = 'Public read') THEN
    CREATE POLICY "Public read" ON public.input_boards FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'replays' AND policyname = 'Public read') THEN
    CREATE POLICY "Public read" ON public.replays FOR SELECT USING (true);
  END IF;
END $$;
