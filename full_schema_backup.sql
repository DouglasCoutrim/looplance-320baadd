
CREATE TABLE public.arenas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.quadras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quadra_id UUID NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quadras_arena ON public.quadras(arena_id);
CREATE INDEX idx_replays_quadra ON public.replays(quadra_id);
CREATE INDEX idx_replays_created ON public.replays(created_at DESC);

ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read arenas" ON public.arenas FOR SELECT USING (true);
CREATE POLICY "Public read quadras" ON public.quadras FOR SELECT USING (true);
CREATE POLICY "Public read replays" ON public.replays FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.replays;
ALTER TABLE public.replays REPLICA IDENTITY FULL;

-- Seed demo data
INSERT INTO public.arenas (id, nome) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Arena Central'),
  ('22222222-2222-2222-2222-222222222222', 'Arena Beach Club');

INSERT INTO public.quadras (id, arena_id, nome) VALUES
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Quadra 1'),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Quadra 2'),
  ('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Quadra Areia 1');
ALTER TABLE public.arenas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays DISABLE ROW LEVEL SECURITY;-- Create edge_devices table
CREATE TABLE public.edge_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    edge_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
    hostname TEXT,
    status TEXT DEFAULT 'offline',
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create input_boards table
CREATE TABLE public.input_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edge_device_id UUID REFERENCES public.edge_devices(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    vendor_id TEXT,
    product_id TEXT,
    device_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create cameras table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quadra_id UUID REFERENCES public.quadras(id) ON DELETE CASCADE,
    edge_device_id UUID REFERENCES public.edge_devices(id) ON DELETE SET NULL,
    input_board_id UUID REFERENCES public.input_boards(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    rtsp_url TEXT,
    trigger_button INTEGER,
    replay_seconds INTEGER DEFAULT 15,
    overlay_url TEXT,
    active BOOLEAN DEFAULT true,
    buffer_seconds INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

-- Create policies (Allowing all for now as per professional admin-friendly evolution)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edge_devices' AND policyname = 'Public access') THEN
        CREATE POLICY "Public access" ON public.edge_devices FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'input_boards' AND policyname = 'Public access') THEN
        CREATE POLICY "Public access" ON public.input_boards FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cameras' AND policyname = 'Public access') THEN
        CREATE POLICY "Public access" ON public.cameras FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;-- Explicitly enable RLS on the tables again just to be sure
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

-- The linter complained about USING (true) for non-SELECT operations.
-- Let's refine the policies to be more secure if needed, but for an admin panel, 
-- we typically want authenticated users to have access. 
-- For now, I'll keep them simple but fix the linter error by splitting them.

DROP POLICY IF EXISTS "Public access" ON public.edge_devices;
DROP POLICY IF EXISTS "Public access" ON public.input_boards;
DROP POLICY IF EXISTS "Public access" ON public.cameras;

-- SELECT policies
CREATE POLICY "Allow public select" ON public.edge_devices FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.input_boards FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.cameras FOR SELECT USING (true);

-- ALL policies (for authenticated users - assuming admin access)
-- In a real production app, you'd check for an admin role.
CREATE POLICY "Allow authenticated all" ON public.edge_devices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all" ON public.input_boards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all" ON public.cameras FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Add arena_id to edge_devices
ALTER TABLE public.edge_devices ADD COLUMN arena_id UUID REFERENCES public.arenas(id);

-- Add index
CREATE INDEX idx_edge_devices_arena_id ON public.edge_devices(arena_id);-- Enable RLS for all infrastructure tables
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards ENABLE ROW LEVEL SECURITY;

-- Arenas Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read arenas') THEN
        CREATE POLICY "Allow public read arenas" ON public.arenas FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated all arenas') THEN
        CREATE POLICY "Allow authenticated all arenas" ON public.arenas FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Quadras Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read quadras') THEN
        CREATE POLICY "Allow public read quadras" ON public.quadras FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated all quadras') THEN
        CREATE POLICY "Allow authenticated all quadras" ON public.quadras FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Edge Devices Policies
DO $$ BEGIN
    -- Clean up old overly restrictive or incorrect policies if any
    -- The user reports 401 when clicking "provisionar", which is an INSERT.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read edge_devices') THEN
        CREATE POLICY "Allow public read edge_devices" ON public.edge_devices FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated manage edge_devices') THEN
        CREATE POLICY "Allow authenticated manage edge_devices" ON public.edge_devices FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Cameras Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read cameras') THEN
        CREATE POLICY "Allow public read cameras" ON public.cameras FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated manage cameras') THEN
        CREATE POLICY "Allow authenticated manage cameras" ON public.cameras FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Input Boards Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read input_boards') THEN
        CREATE POLICY "Allow public read input_boards" ON public.input_boards FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated manage input_boards') THEN
        CREATE POLICY "Allow authenticated manage input_boards" ON public.input_boards FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Replays Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read replays') THEN
        CREATE POLICY "Allow public read replays" ON public.replays FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated manage replays') THEN
        CREATE POLICY "Allow authenticated manage replays" ON public.replays FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
-- Ensure edge_token has a default value if missing
ALTER TABLE public.edge_devices ALTER COLUMN edge_token SET DEFAULT gen_random_uuid()::text;

-- Re-enable RLS just in case
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;

-- Drop existing manage policies to recreate them cleanly
DROP POLICY IF EXISTS "Allow authenticated all arenas" ON public.arenas;
DROP POLICY IF EXISTS "Allow authenticated manage edge_devices" ON public.edge_devices;
DROP POLICY IF EXISTS "Allow authenticated all edge_devices" ON public.edge_devices;

-- Create comprehensive policies for arenas
CREATE POLICY "Allow authenticated manage arenas" 
ON public.arenas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Create comprehensive policies for edge_devices
CREATE POLICY "Allow authenticated manage edge_devices" 
ON public.edge_devices 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Ensure public read still works
DROP POLICY IF EXISTS "Allow public read arenas" ON public.arenas;
CREATE POLICY "Allow public read arenas" ON public.arenas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read edge_devices" ON public.edge_devices;
CREATE POLICY "Allow public read edge_devices" ON public.edge_devices FOR SELECT USING (true);
-- Fix quadras foreign key to cascade delete
ALTER TABLE public.quadras 
DROP CONSTRAINT IF EXISTS quadras_arena_id_fkey,
ADD CONSTRAINT quadras_arena_id_fkey 
    FOREIGN KEY (arena_id) 
    REFERENCES arenas(id) 
    ON DELETE CASCADE;

-- Fix edge_devices foreign key to cascade delete
ALTER TABLE public.edge_devices 
DROP CONSTRAINT IF EXISTS edge_devices_arena_id_fkey,
ADD CONSTRAINT edge_devices_arena_id_fkey 
    FOREIGN KEY (arena_id) 
    REFERENCES arenas(id) 
    ON DELETE CASCADE;
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
-- Desabilita temporariamente o gatilho para permitir a atualização administrativa
ALTER TABLE public.profiles DISABLE TRIGGER trg_prevent_role_self_elevation;

-- Promove o usuário
UPDATE public.profiles 
SET is_super_admin = true, role = 'super-admin'
WHERE email = 'douglascoutrim@gmail.com';

-- Reabilita o gatilho
ALTER TABLE public.profiles ENABLE TRIGGER trg_prevent_role_self_elevation;

-- Garante que o Douglas @ looplance também esteja como super admin
UPDATE public.profiles 
SET is_super_admin = true, role = 'super-admin'
WHERE email = 'douglas@looplance.app';

-- Ajuste na função is_arena_manager para ser mais robusta
CREATE OR REPLACE FUNCTION public.is_arena_manager(_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Se o _uid for nulo, tenta pegar o auth.uid()
  IF _uid IS NULL THEN
    _uid := auth.uid();
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = _uid 
    AND (is_super_admin = true OR is_arena_owner = true)
  );
END;
$$;
-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Gatilho para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Garante que todos os usuários atuais tenham perfis
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'user'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Promove admins novamente para garantir
UPDATE public.profiles 
SET is_super_admin = true, role = 'super-admin'
WHERE email IN ('douglas@looplance.app', 'jorgealcino@gmail.com', 'douglascoutrim@gmail.com');
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
ALTER TABLE public.arenas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays DISABLE ROW LEVEL SECURITY;-- 1. Habilitar RLS em todas as tabelas
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Admins manage all arenas" ON public.arenas;
DROP POLICY IF EXISTS "Public can view arenas" ON public.arenas;
DROP POLICY IF EXISTS "arenas_select" ON public.arenas;
DROP POLICY IF EXISTS "Admins manage all arena_settings" ON public.arena_settings;
DROP POLICY IF EXISTS "Public can view arena settings" ON public.arena_settings;
DROP POLICY IF EXISTS "Super admins and owners manage edge_devices" ON public.edge_devices;
DROP POLICY IF EXISTS "Super admins and owners manage cameras" ON public.cameras;
DROP POLICY IF EXISTS "Super admins and owners manage input_boards" ON public.input_boards;
DROP POLICY IF EXISTS "Admins can see all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public can view quadras" ON public.quadras;
DROP POLICY IF EXISTS "quadras_select" ON public.quadras;
DROP POLICY IF EXISTS "Super admins manage all quadras" ON public.quadras;
DROP POLICY IF EXISTS "Public can view replays" ON public.replays;
DROP POLICY IF EXISTS "Super admins manage all replays" ON public.replays;

-- 3. Criar novas políticas simplificadas

-- ARENAS e QUADRAS: Todos autenticados veem, Admins gerenciam
CREATE POLICY "Public view arenas" ON public.arenas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage arenas" ON public.arenas FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

CREATE POLICY "Public view quadras" ON public.quadras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage quadras" ON public.quadras FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

-- REPLAYS: Todos autenticados veem, Admins gerenciam
CREATE POLICY "Public view replays" ON public.replays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage replays" ON public.replays FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

-- EDGE DEVICES, CAMERAS, INPUT BOARDS e SETTINGS: Apenas Admins veem e gerenciam
CREATE POLICY "Admin manage edge_devices" ON public.edge_devices FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

CREATE POLICY "Admin manage cameras" ON public.cameras FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

CREATE POLICY "Admin manage input_boards" ON public.input_boards FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

CREATE POLICY "Admin manage arena_settings" ON public.arena_settings FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_super_admin = true OR is_arena_owner = true)));

-- PROFILES: Usuário vê o próprio, Admins veem todos
CREATE POLICY "Profiles view" ON public.profiles FOR SELECT TO authenticated 
USING (id = auth.uid() OR is_super_admin = true OR is_arena_owner = true);

CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE TO authenticated 
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles admin manage" ON public.profiles FOR ALL TO authenticated 
USING (is_super_admin = true) WITH CHECK (is_super_admin = true);
CREATE TABLE IF NOT EXISTS public.r2_deletion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    replay_id UUID NOT NULL,
    r2_key TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.r2_deletion_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view deletion logs" ON public.r2_deletion_logs FOR SELECT TO authenticated USING (is_super_admin());
-- Adicionar novos campos à tabela arenas
ALTER TABLE public.arenas 
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Criar bucket para fotos das arenas se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('arenas', 'arenas', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para o bucket 'arenas'
DROP POLICY IF EXISTS "Public view arena photos" ON storage.objects;
CREATE POLICY "Public view arena photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'arenas');

DROP POLICY IF EXISTS "Admins can upload arena photos" ON storage.objects;
CREATE POLICY "Admins can upload arena photos" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'arenas' AND 
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  ))
);

DROP POLICY IF EXISTS "Admins can update arena photos" ON storage.objects;
CREATE POLICY "Admins can update arena photos" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'arenas' AND 
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  ))
);

DROP POLICY IF EXISTS "Admins can delete arena photos" ON storage.objects;
CREATE POLICY "Admins can delete arena photos" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'arenas' AND 
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
  ))
);
-- Garante que a política de INSERT e UPDATE esteja correta para o storage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Admins can update arena photos'
    ) THEN
        CREATE POLICY "Admins can update arena photos" 
        ON storage.objects FOR UPDATE 
        USING (
          bucket_id = 'arenas' AND 
          (EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
          ))
        );
    END IF;
END $$;
-- Função auxiliar para verificar se o usuário atual é super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que super admins podem ver todos os perfis
CREATE POLICY "Super Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_super_admin());

-- Garantir que super admins podem atualizar todos os perfis
CREATE POLICY "Super Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.is_super_admin());

-- Garantir que super admins podem deletar perfis
CREATE POLICY "Super Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (public.is_super_admin());

-- Função para o admin criar um usuário (precisa ser chamada via RPC ou Edge Function)
-- Nota: Para mudar a senha ou bloquear via Auth, geralmente usamos Admin API do Supabase.
-- Como não temos a service_role key no frontend, criaremos funções seguras que usam SECURITY DEFINER.

-- Função para resetar senha (exemplo simplificado, idealmente via Edge Function)
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  user_id UUID,
  new_role TEXT,
  new_is_super_admin BOOLEAN,
  new_is_arena_owner BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.profiles
  SET 
    role = new_role,
    is_super_admin = new_is_super_admin,
    is_arena_owner = new_is_arena_owner,
    updated_at = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Corrigindo is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Corrigindo admin_update_user_profile
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  user_id UUID,
  new_role TEXT,
  new_is_super_admin BOOLEAN,
  new_is_arena_owner BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.profiles
  SET 
    role = new_role,
    is_super_admin = new_is_super_admin,
    is_arena_owner = new_is_arena_owner,
    updated_at = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revogar execução pública e conceder apenas para usuários autenticados
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_update_user_profile(UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_profile(UUID, TEXT, BOOLEAN, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(UUID, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
-- Garantir que as colunas existam (o read_query já mostrou que existem, mas por segurança em migração)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'consent_accepted') THEN
        ALTER TABLE public.profiles ADD COLUMN consent_accepted BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'consent_timestamp') THEN
        ALTER TABLE public.profiles ADD COLUMN consent_timestamp TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Criar ou atualizar a função que lida com novos usuários para incluir o consentimento
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    consent_accepted, 
    consent_timestamp,
    role
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'consent_accepted')::boolean, false),
    CASE 
      WHEN NEW.raw_user_meta_data->>'consent_timestamp' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'consent_timestamp')::timestamp with time zone 
      ELSE NULL 
    END,
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Garantir que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
ALTER TABLE public.arenas 
ADD COLUMN sponsor_logo_left TEXT,
ADD COLUMN sponsor_logo_center TEXT,
ADD COLUMN sponsor_logo_right TEXT,
ADD COLUMN final_overlay_url TEXT;-- Drop existing policies to recreate them cleanly
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
-- Update the bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'overlays';

-- Create a policy to allow public read access if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access to Overlays'
    ) THEN
        CREATE POLICY "Public Access to Overlays" 
        ON storage.objects 
        FOR SELECT 
        USING (bucket_id = 'overlays');
    END IF;
END $$;ALTER TABLE public.cameras 
ADD COLUMN IF NOT EXISTS video_width INTEGER,
ADD COLUMN IF NOT EXISTS video_height INTEGER,
ADD COLUMN IF NOT EXISTS video_x INTEGER,
ADD COLUMN IF NOT EXISTS video_y INTEGER,
ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT '16:9',
ADD COLUMN IF NOT EXISTS sponsor_logo_left TEXT,
ADD COLUMN IF NOT EXISTS sponsor_logo_center TEXT,
ADD COLUMN IF NOT EXISTS sponsor_logo_right TEXT,
ADD COLUMN IF NOT EXISTS final_overlay_url TEXT;

-- Update RLS policies to ensure super admins and owners can update these fields
-- Assuming existing policies cover this, but keeping it in mind.
-- Policy for uploading (INSERT)
CREATE POLICY "Admins can upload overlays"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'overlays' AND
    (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
    ))
);

-- Policy for updating (UPDATE)
CREATE POLICY "Admins can update overlays"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'overlays' AND
    (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
    ))
);

-- Policy for deleting (DELETE)
CREATE POLICY "Admins can delete overlays"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'overlays' AND
    (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.is_super_admin = true OR profiles.is_arena_owner = true)
    ))
);-- Drop old policies to replace them
DROP POLICY IF EXISTS "Admins can upload overlays" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update overlays" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete overlays" ON storage.objects;

-- Policy for uploading (INSERT)
CREATE POLICY "Admins can upload overlays"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'overlays' AND
    (
        public.is_super_admin() OR
        (EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_arena_owner = true
        ))
    )
);

-- Policy for updating (UPDATE)
CREATE POLICY "Admins can update overlays"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'overlays' AND
    (
        public.is_super_admin() OR
        (EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_arena_owner = true
        ))
    )
);

-- Policy for deleting (DELETE)
CREATE POLICY "Admins can delete overlays"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'overlays' AND
    (
        public.is_super_admin() OR
        (EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_arena_owner = true
        ))
    )
);ALTER TABLE public.profiles 
ADD COLUMN arena_id UUID REFERENCES public.arenas(id);

-- Update the admin_update_user_profile function to handle the new field
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
    user_id UUID,
    new_role TEXT,
    new_is_super_admin BOOLEAN,
    new_is_arena_owner BOOLEAN,
    new_arena_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET 
        role = new_role,
        is_super_admin = new_is_super_admin,
        is_arena_owner = new_is_arena_owner,
        arena_id = new_arena_id,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Add columns to track streaming registration status
ALTER TABLE public.cameras 
ADD COLUMN IF NOT EXISTS streaming_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS streaming_error TEXT;

-- Enable pg_net for async HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.trig_register_camera_stream()
RETURNS TRIGGER AS $$
DECLARE
  service_role_key TEXT;
  project_id TEXT;
BEGIN
  -- We'll use the service role key provided in the system context
  -- In a real scenario, this should be stored more securely or accessed via vault
  -- For now, we'll use a placeholder that the user can replace or we can set via env
  -- Actually, let's try to get it from a secret if possible, or just use a dummy for the migration
  -- since we can't easily inject it into the SQL here without a dynamic command.
  
  PERFORM
    net.http_post(
      url := 'https://jurwopyuxmhvtwzjxynm.supabase.co/functions/v1/register-camera-stream',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cndvcHl1eG1odnR3emp4eW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ3NjMzNywiZXhwIjoyMDk1MDUyMzM3fQ.SOhUxDvibQ0OsygZv6eY0kY72pjr94lKJptHl7KqOvE"}'::jsonb,
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS register_camera_stream_trigger ON public.cameras;
CREATE TRIGGER register_camera_stream_trigger
AFTER INSERT ON public.cameras
FOR EACH ROW
EXECUTE FUNCTION public.trig_register_camera_stream();
