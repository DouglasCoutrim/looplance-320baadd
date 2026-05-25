CREATE TABLE IF NOT EXISTS public.r2_deletion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    replay_id UUID NOT NULL,
    r2_key TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.r2_deletion_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view deletion logs" ON public.r2_deletion_logs FOR SELECT TO authenticated USING (is_super_admin());
