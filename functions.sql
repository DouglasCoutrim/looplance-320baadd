-- SQL Functions Backup

CREATE OR REPLACE FUNCTION public.is_arena_manager(_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o _uid for nulo, tenta pegar o auth.uid()
  IF _uid IS NULL THEN
    _uid := auth.uid();
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = _uid 
    AND (is_super_admin = true OR is_arena_owner = true)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = _uid),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_arena_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.arena_settings (arena_id)
    VALUES (NEW.id)
    ON CONFLICT (arena_id) DO NOTHING;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_user_profile(user_id uuid, new_role text, new_is_super_admin boolean, new_is_arena_owner boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.profiles
  SET 
    role = new_role,
    is_super_admin = new_is_super_admin,
    is_arena_owner = new_is_arena_owner,
    updated_at = now()
  WHERE id = user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    consent_accepted, 
    consent_timestamp,
    role
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'consent_accepted')::boolean, false),
    CASE 
      WHEN NEW.raw_user_meta_data->>'consent_timestamp' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'consent_timestamp')::timestamp with time zone 
      ELSE NULL 
    END,
    'user'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_role_self_elevation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
       OR NEW.is_arena_owner IS DISTINCT FROM OLD.is_arena_owner THEN
      RAISE EXCEPTION 'Not authorized to modify role flags';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Additional variant of admin_update_user_profile
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(user_id uuid, new_role text, new_is_super_admin boolean, new_is_arena_owner boolean, new_arena_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;
