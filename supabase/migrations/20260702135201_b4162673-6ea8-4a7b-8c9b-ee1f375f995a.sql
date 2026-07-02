-- =========================================================
-- 1. Tabela CLIENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  documento text,                       -- CPF ou CNPJ (somente números ou formatado)
  documento_tipo text CHECK (documento_tipo IN ('cpf','cnpj')),
  telefone text,
  endereco text,
  cidade text,
  estado text,                          -- UF (2 letras)
  is_frozen boolean NOT NULL DEFAULT false,
  frozen_at timestamptz,
  frozen_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver clientes"
  ON public.clients FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Admins podem inserir clientes"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Admins podem atualizar clientes"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Admins podem deletar clientes"
  ON public.clients FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- Trigger updated_at
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================
-- 2. Vínculo em EDGE_DEVICES
-- =========================================================
ALTER TABLE public.edge_devices
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_edge_devices_client_id ON public.edge_devices(client_id);

-- =========================================================
-- 3. Função: cliente do edge está ativo?
--    Usada pelas rotas do edge (heartbeat/config/replay)
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_is_edge_client_active(p_edge_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT NOT c.is_frozen
      FROM public.edge_devices e
      LEFT JOIN public.clients c ON c.id = e.client_id
      WHERE e.edge_token = p_edge_token
      LIMIT 1
    ),
    true  -- se edge sem cliente vinculado, considera ativo
  );
$$;

REVOKE ALL ON FUNCTION public.fn_is_edge_client_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_is_edge_client_active(text) TO anon, authenticated, service_role;

-- =========================================================
-- 4. Bloqueia registro de replay se cliente congelado
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_register_replay(
  p_edge_token text, p_quadra_id uuid, p_r2_key text,
  p_video_url text, p_duration_sec numeric, p_file_size_bytes bigint
)
RETURNS public.replays
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device public.edge_devices%rowtype;
  v_quadra public.quadras%rowtype;
  v_replay public.replays%rowtype;
  v_client_frozen boolean;
BEGIN
  SELECT * INTO v_device FROM public.edge_devices WHERE edge_token = p_edge_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'edge_token inválido' USING errcode = '28000';
  END IF;

  -- Bloqueia clientes congelados
  IF v_device.client_id IS NOT NULL THEN
    SELECT is_frozen INTO v_client_frozen FROM public.clients WHERE id = v_device.client_id;
    IF v_client_frozen THEN
      RAISE EXCEPTION 'Serviço suspenso para este cliente. Contate o suporte.' USING errcode = '42501';
    END IF;
  END IF;

  SELECT * INTO v_quadra FROM public.quadras WHERE id = p_quadra_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quadra_id não encontrada';
  END IF;

  IF v_quadra.arena_id <> v_device.arena_id THEN
    RAISE EXCEPTION 'quadra não pertence à arena deste edge device';
  END IF;

  INSERT INTO public.replays (arena_id, quadra_id, edge_device_id, video_url, r2_key, duration_sec, file_size_bytes)
  VALUES (v_quadra.arena_id, v_quadra.id, v_device.id, p_video_url, p_r2_key, p_duration_sec, p_file_size_bytes)
  RETURNING * INTO v_replay;

  RETURN v_replay;
END;
$$;

-- =========================================================
-- 5. Heartbeat também respeita congelamento
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_touch_edge_heartbeat(
  p_edge_token text, p_hostname text, p_local_ip text,
  p_version text, p_uptime_seconds integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_frozen boolean;
BEGIN
  SELECT c.is_frozen INTO v_client_frozen
  FROM public.edge_devices e
  LEFT JOIN public.clients c ON c.id = e.client_id
  WHERE e.edge_token = p_edge_token
  LIMIT 1;

  IF v_client_frozen THEN
    RAISE EXCEPTION 'Serviço suspenso para este cliente.' USING errcode = '42501';
  END IF;

  UPDATE public.edge_devices
     SET status = 'online',
         last_seen = now(),
         hostname = COALESCE(p_hostname, hostname),
         local_ip = COALESCE(p_local_ip, local_ip),
         edge_version = COALESCE(p_version, edge_version),
         uptime_seconds = COALESCE(p_uptime_seconds, uptime_seconds)
   WHERE edge_token = p_edge_token;
END;
$$;