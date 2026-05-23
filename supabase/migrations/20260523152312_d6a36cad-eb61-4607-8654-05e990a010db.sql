-- Fix quadras foreign key to cascade delete
ALTER TABLE public.quadras 
DROP CONSTRAINT IF EXISTS quadras_arena_id_fkey,
ADD CONSTRAINT quadras_arena_id_fkey 
    FOREIGN KEY (arena_id) 
    REFERENCES arenas(id) 
    ON DELETE CASCADE;

-- Fix edge_devices foreign key to cascade delete
ALTER TABLE public.edge_devices 
DROP CONSTRAINT IF EXISTS edge_devices_arena_id_fkey,
ADD CONSTRAINT edge_devices_arena_id_fkey 
    FOREIGN KEY (arena_id) 
    REFERENCES arenas(id) 
    ON DELETE CASCADE;
