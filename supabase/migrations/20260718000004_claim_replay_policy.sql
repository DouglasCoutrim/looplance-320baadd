-- Migration: Permite que usuarios autenticados reivindiquem replays sem dono
-- Usa SECURITY DEFINER para bypassar RLS.

CREATE OR REPLACE FUNCTION public.claim_replay(p_replay_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.replays
  SET user_id = auth.uid()
  WHERE id = p_replay_id
    AND user_id IS NULL;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_replay TO authenticated;
