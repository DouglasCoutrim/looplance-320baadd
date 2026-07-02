CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, email text, full_name text, cpf text, arena_id uuid, arena_nome text, role text, is_super_admin boolean, is_arena_owner boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_arena uuid;
BEGIN
  IF NOT (public.is_super_admin() OR public.is_arena_manager(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT p.arena_id INTO v_caller_arena FROM public.profiles p WHERE p.id = auth.uid();

  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.cpf,
         p.arena_id, a.nome AS arena_nome, p.role,
         p.is_super_admin, p.is_arena_owner, p.created_at
  FROM public.profiles p
  LEFT JOIN public.arenas a ON a.id = p.arena_id
  WHERE public.is_super_admin()
     OR p.arena_id = v_caller_arena
  ORDER BY p.created_at DESC;
END;
$function$;