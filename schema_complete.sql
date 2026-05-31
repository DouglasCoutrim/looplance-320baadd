-- Complete Database Schema Backup
-- Generated for Looplance Edge

-- 1. Arenas Table
CREATE TABLE public.arenas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    cidade TEXT,
    telefone TEXT,
    endereco TEXT,
    foto_url TEXT,
    sponsor_logo_left TEXT,
    sponsor_logo_center TEXT,
    sponsor_logo_right TEXT,
    final_overlay_url TEXT
);

-- 2. Quadras Table
CREATE TABLE public.quadras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arena_id UUID REFERENCES public.arenas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Arena Settings Table
CREATE TABLE public.arena_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arena_id UUID UNIQUE NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    replay_retention_days INTEGER DEFAULT 7 NOT NULL,
    auto_cleanup_enabled BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Edge Devices Table
CREATE TABLE public.edge_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arena_id UUID REFERENCES public.arenas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    edge_token TEXT UNIQUE DEFAULT (gen_random_uuid())::text,
    hostname TEXT,
    local_ip TEXT,
    status TEXT DEFAULT 'offline'::text,
    last_seen TIMESTAMP WITH TIME ZONE,
    edge_version TEXT,
    uptime_seconds BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Input Boards Table
CREATE TABLE public.input_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edge_device_id UUID REFERENCES public.edge_devices(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    vendor_id TEXT,
    product_id TEXT,
    device_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Cameras Table
CREATE TABLE public.cameras (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    aspect_ratio TEXT DEFAULT '16:9'::text,
    sponsor_logo_left TEXT,
    sponsor_logo_center TEXT,
    sponsor_logo_right TEXT,
    final_overlay_url TEXT,
    video_width INTEGER,
    video_height INTEGER,
    video_x INTEGER,
    video_y INTEGER,
    streaming_status TEXT DEFAULT 'pending'::text,
    streaming_error TEXT
);

-- 7. Profiles Table
-- NOTE: Requires auth.users to exist (Supabase standard)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'user'::text,
    is_super_admin BOOLEAN DEFAULT false,
    is_arena_owner BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    consent_accepted BOOLEAN DEFAULT false,
    consent_timestamp TIMESTAMP WITH TIME ZONE,
    cpf TEXT,
    birth_date DATE,
    arena_id UUID REFERENCES public.arenas(id)
);

-- 8. Replays Table
CREATE TABLE public.replays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quadra_id UUID REFERENCES public.quadras(id) ON DELETE CASCADE,
    edge_device_id UUID REFERENCES public.edge_devices(id),
    video_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    duration_sec INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    r2_key TEXT,
    arena_id UUID REFERENCES public.arenas(id)
);

-- 9. Debug Logs Table
CREATE TABLE public.debug_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10. R2 Deletion Logs Table
CREATE TABLE public.r2_deletion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    r2_key TEXT NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    metadata JSONB
);
