
-- Novo gerador de edge_token curto (8 chars alfanuméricos, sem caracteres ambíguos)
CREATE OR REPLACE FUNCTION public.fn_generate_edge_token()
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

-- Nova palavra-chave: uma palavra simples em português
CREATE OR REPLACE FUNCTION public.fn_generate_install_passphrase()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  words text[] := ARRAY[
    'bicicleta','laranja','montanha','cachorro','elefante','floresta','girafa','janela',
    'lampada','melancia','navio','oceano','pipoca','quadro','raposa','sapato',
    'tigre','uva','violino','xadrez','zebra','abacaxi','borboleta','castelo',
    'dragao','estrela','foguete','guitarra','helicoptero','iglu','jaguar','koala',
    'limao','morango','nuvem','ovelha','panda','queijo','relogio','sereia',
    'trovao','urso','vulcao','baleia','cenoura','diamante','esquilo','flamingo',
    'girassol','hipopotamo','ilha','jacare','kiwi','leao','martelo','ninho',
    'oasis','peixe','rabanete','sanfona','tomate','universo','vagalume','xicara'
  ];
BEGIN
  RETURN words[1 + floor(random() * array_length(words, 1))::int];
END;
$$;

-- Aplica novo default ao edge_token
ALTER TABLE public.edge_devices
  ALTER COLUMN edge_token SET DEFAULT public.fn_generate_edge_token();

-- Regenera tokens e palavras-chave existentes para o novo formato
UPDATE public.edge_devices
SET edge_token = public.fn_generate_edge_token(),
    install_passphrase = public.fn_generate_install_passphrase();
