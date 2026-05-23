-- Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMP WITH TIME ZONE;

-- Update handle_new_user function to handle metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    is_super_admin, 
    full_name, 
    cpf, 
    birth_date, 
    consent_accepted, 
    consent_timestamp
  )
  VALUES (
    new.id, 
    new.email, 
    COALESCE((new.raw_user_meta_data->>'is_super_admin')::boolean, false),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'cpf',
    (new.raw_user_meta_data->>'birth_date')::date,
    COALESCE((new.raw_user_meta_data->>'consent_accepted')::boolean, false),
    CASE 
      WHEN (new.raw_user_meta_data->>'consent_accepted')::boolean = true 
      THEN now() 
      ELSE NULL 
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    cpf = EXCLUDED.cpf,
    birth_date = EXCLUDED.birth_date,
    consent_accepted = EXCLUDED.consent_accepted,
    consent_timestamp = EXCLUDED.consent_timestamp,
    updated_at = now();
  RETURN new;
END;
$$;
