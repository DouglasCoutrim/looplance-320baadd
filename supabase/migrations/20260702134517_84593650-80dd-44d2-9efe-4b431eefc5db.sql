-- Adiciona coluna install_passphrase
ALTER TABLE public.edge_devices
  ADD COLUMN IF NOT EXISTS install_passphrase text;

-- Função para gerar passphrase curta (8 chars, sem caracteres ambíguos)
CREATE OR REPLACE FUNCTION public.fn_generate_install_passphrase()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Default para novos registros
ALTER TABLE public.edge_devices
  ALTER COLUMN install_passphrase SET DEFAULT public.fn_generate_install_passphrase();

-- Preenche registros existentes
UPDATE public.edge_devices
   SET install_passphrase = public.fn_generate_install_passphrase()
 WHERE install_passphrase IS NULL;

-- Torna NOT NULL a partir de agora
ALTER TABLE public.edge_devices
  ALTER COLUMN install_passphrase SET NOT NULL;