
CREATE TABLE public.manual_replay_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id uuid NOT NULL REFERENCES public.cameras(id) ON DELETE CASCADE,
  edge_device_id uuid REFERENCES public.edge_devices(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','consumed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE INDEX idx_mrt_pending_device
  ON public.manual_replay_triggers (edge_device_id, status)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_replay_triggers TO authenticated;
GRANT ALL ON public.manual_replay_triggers TO service_role;

ALTER TABLE public.manual_replay_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin manage manual triggers"
  ON public.manual_replay_triggers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "arena_owner manage manual triggers of own arena"
  ON public.manual_replay_triggers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cameras c
      JOIN public.quadras q ON q.id = c.quadra_id
      WHERE c.id = manual_replay_triggers.camera_id
        AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = 'arena_owner'
            AND ur.arena_id = q.arena_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cameras c
      JOIN public.quadras q ON q.id = c.quadra_id
      WHERE c.id = manual_replay_triggers.camera_id
        AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = 'arena_owner'
            AND ur.arena_id = q.arena_id
        )
    )
  );
