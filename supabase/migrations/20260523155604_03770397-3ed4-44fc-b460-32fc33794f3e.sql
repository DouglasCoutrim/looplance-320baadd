-- 1. Backup
CREATE TABLE IF NOT EXISTS public.profiles_backup AS SELECT * FROM public.profiles;

-- 2. Limpeza de dependências
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Recriar tabela
DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Restaurar dados
INSERT INTO public.profiles (id, email, is_super_admin, created_at, updated_at)
SELECT id, email, is_super_admin, created_at, updated_at FROM public.profiles_backup;

-- 5. Função de trigger simplificada
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_super_admin)
  VALUES (new.id, new.email, false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Desabilitar RLS para teste definitivo
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
