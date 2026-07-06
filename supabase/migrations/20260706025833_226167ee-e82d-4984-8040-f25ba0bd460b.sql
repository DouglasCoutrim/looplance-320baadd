
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('comment','replay')),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 120),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dismissed','reviewed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can create a report (as themselves).
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Only admins can read reports.
CREATE POLICY "reports_select_admin" ON public.reports
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Only admins can update reports (change status, add reviewer).
CREATE POLICY "reports_update_admin" ON public.reports
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX reports_status_idx ON public.reports (status, created_at DESC);
CREATE INDEX reports_reporter_target_idx ON public.reports (reporter_id, target_type, target_id);

CREATE TRIGGER reports_touch_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
