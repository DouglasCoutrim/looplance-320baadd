-- Add arena_id to edge_devices
ALTER TABLE public.edge_devices ADD COLUMN arena_id UUID REFERENCES public.arenas(id);

-- Add index
CREATE INDEX idx_edge_devices_arena_id ON public.edge_devices(arena_id);