-- Migration: Permite que usuarios autenticados reivindiquem replays sem dono

CREATE POLICY "authenticated_claim_replay"
  ON public.replays FOR UPDATE
  TO authenticated
  USING (user_id IS NULL)
  WITH CHECK (user_id = auth.uid());
