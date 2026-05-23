-- Create edge_devices table
CREATE TABLE public.edge_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    edge_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
    hostname TEXT,
    status TEXT DEFAULT 'offline',
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create input_boards table
CREATE TABLE public.input_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edge_device_id UUID REFERENCES public.edge_devices(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    vendor_id TEXT,
    product_id TEXT,
    device_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create cameras table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quadra_id UUID REFERENCES public.quadras(id) ON DELETE CASCADE,
    edge_device_id UUID REFERENCES public.edge_devices(id) ON DELETE SET NULL,
    input_board_id UUID REFERENCES public.input_boards(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    rtsp_url TEXT,
    trigger_button INTEGER,
    replay_seconds INTEGER DEFAULT 15,
    overlay_url TEXT,
    active BOOLEAN DEFAULT true,
    buffer_seconds INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

-- Create policies (Allowing all for now as per professional admin-friendly evolution)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edge_devices' AND policyname = 'Public access') THEN
        CREATE POLICY "Public access" ON public.edge_devices FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'input_boards' AND policyname = 'Public access') THEN
        CREATE POLICY "Public access" ON public.input_boards FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cameras' AND policyname = 'Public access') THEN
        CREATE POLICY "Public access" ON public.cameras FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;