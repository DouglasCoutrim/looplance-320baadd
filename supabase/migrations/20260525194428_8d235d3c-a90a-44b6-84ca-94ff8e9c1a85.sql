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
