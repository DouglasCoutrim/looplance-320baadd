ALTER TABLE public.profiles 
ADD COLUMN arena_id UUID REFERENCES public.arenas(id);

-- Update the admin_update_user_profile function to handle the new field
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
    user_id UUID,
    new_role TEXT,
    new_is_super_admin BOOLEAN,
    new_is_arena_owner BOOLEAN,
    new_arena_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET 
        role = new_role,
        is_super_admin = new_is_super_admin,
        is_arena_owner = new_is_arena_owner,
        arena_id = new_arena_id,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
