CREATE TABLE IF NOT EXISTS public.botoeiras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    botoeira_id TEXT NOT NULL,
    ip_local TEXT NOT NULL,
    local_key TEXT NOT NULL,
    camera_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.botoeiras ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.botoeiras TO authenticated;
GRANT ALL ON public.botoeiras TO service_role;

-- Policies (Assuming admin access for authenticated users for now)
CREATE POLICY "Enable all access for authenticated users" ON public.botoeiras
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_botoeiras_updated_at
    BEFORE UPDATE ON public.botoeiras
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();