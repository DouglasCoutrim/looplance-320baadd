-- Fix: colunas faltantes na tabela cameras
ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS final_overlay_url text,
  ADD COLUMN IF NOT EXISTS video_x integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_y integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_width integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_height integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aspect_ratio text NOT NULL DEFAULT '16:9'
    CHECK (aspect_ratio IN ('16:9', '9:16', '4:3', '1:1')),
  ADD COLUMN IF NOT EXISTS sponsor_logo_left text,
  ADD COLUMN IF NOT EXISTS sponsor_logo_center text,
  ADD COLUMN IF NOT EXISTS sponsor_logo_right text,
  ADD COLUMN IF NOT EXISTS streaming_status text NOT NULL DEFAULT 'offline'
    CHECK (streaming_status IN ('online', 'offline', 'error', 'starting')),
  ADD COLUMN IF NOT EXISTS streaming_error text;

-- Fix: colunas faltantes na tabela edge_devices
ALTER TABLE public.edge_devices
  ADD COLUMN IF NOT EXISTS arena_id uuid REFERENCES public.arenas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS local_ip text,
  ADD COLUMN IF NOT EXISTS uptime_seconds integer,
  ADD COLUMN IF NOT EXISTS edge_version text;

-- Índices
CREATE INDEX IF NOT EXISTS idx_cameras_edge_device ON public.cameras(edge_device_id);
CREATE INDEX IF NOT EXISTS idx_edge_devices_arena ON public.edge_devices(arena_id);
