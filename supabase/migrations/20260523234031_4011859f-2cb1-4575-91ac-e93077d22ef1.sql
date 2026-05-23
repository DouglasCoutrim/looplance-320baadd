
-- 1. Drop the leaking backup table
DROP TABLE IF EXISTS public.profiles_backup;

-- 2. Helper: is_admin() — SECURITY DEFINER to avoid RLS recursion on profiles
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = _uid),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_arena_manager(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (is_super_admin OR is_arena_owner) FROM public.profiles WHERE id = _uid),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_arena_manager(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticator;
GRANT EXECUTE ON FUNCTION public.is_arena_manager(uuid) TO authenticator;

-- 3. Harden existing SECURITY DEFINER trigger functions
CREATE OR REPLACE FUNCTION public.handle_new_arena_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.arena_settings (arena_id)
    VALUES (NEW.id)
    ON CONFLICT (arena_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, is_super_admin, full_name, cpf, birth_date,
    consent_accepted, consent_timestamp
  )
  VALUES (
    new.id,
    new.email,
    false, -- never trust client metadata for admin flag
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'cpf',
    (new.raw_user_meta_data->>'birth_date')::date,
    COALESCE((new.raw_user_meta_data->>'consent_accepted')::boolean, false),
    CASE WHEN (new.raw_user_meta_data->>'consent_accepted')::boolean = true
         THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    cpf = EXCLUDED.cpf,
    birth_date = EXCLUDED.birth_date,
    consent_accepted = EXCLUDED.consent_accepted,
    consent_timestamp = EXCLUDED.consent_timestamp,
    updated_at = now();
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_arena_settings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 4. Drop all existing permissive policies before recreating
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles','arenas','quadras','replays','cameras','edge_devices','input_boards','arena_settings')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 5. Enable RLS everywhere
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arenas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_devices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_boards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_settings ENABLE ROW LEVEL SECURITY;

-- 6. profiles policies
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- INSERT into profiles is performed by the handle_new_user trigger (SECURITY DEFINER); no client INSERT policy needed.
-- Allow users to upsert their own profile from the complete-profile flow:
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Prevent non-admins from elevating privileges via UPDATE
CREATE OR REPLACE FUNCTION public.prevent_role_self_elevation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
       OR NEW.is_arena_owner IS DISTINCT FROM OLD.is_arena_owner THEN
      RAISE EXCEPTION 'Not authorized to modify role flags';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_role_self_elevation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_role_self_elevation ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_elevation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_elevation();

-- 7. arenas / quadras / replays — public read, admin write
CREATE POLICY "Public read arenas"
  ON public.arenas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage arenas"
  ON public.arenas FOR ALL TO authenticated
  USING (public.is_arena_manager(auth.uid()))
  WITH CHECK (public.is_arena_manager(auth.uid()));

CREATE POLICY "Public read quadras"
  ON public.quadras FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage quadras"
  ON public.quadras FOR ALL TO authenticated
  USING (public.is_arena_manager(auth.uid()))
  WITH CHECK (public.is_arena_manager(auth.uid()));

CREATE POLICY "Public read replays"
  ON public.replays FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage replays"
  ON public.replays FOR ALL TO authenticated
  USING (public.is_arena_manager(auth.uid()))
  WITH CHECK (public.is_arena_manager(auth.uid()));

-- 8. cameras / edge_devices / input_boards — admin only (contain credentials)
CREATE POLICY "Admins read cameras"
  ON public.cameras FOR SELECT TO authenticated
  USING (public.is_arena_manager(auth.uid()));
CREATE POLICY "Admins manage cameras"
  ON public.cameras FOR ALL TO authenticated
  USING (public.is_arena_manager(auth.uid()))
  WITH CHECK (public.is_arena_manager(auth.uid()));

CREATE POLICY "Admins read edge_devices"
  ON public.edge_devices FOR SELECT TO authenticated
  USING (public.is_arena_manager(auth.uid()));
CREATE POLICY "Admins manage edge_devices"
  ON public.edge_devices FOR ALL TO authenticated
  USING (public.is_arena_manager(auth.uid()))
  WITH CHECK (public.is_arena_manager(auth.uid()));

CREATE POLICY "Admins read input_boards"
  ON public.input_boards FOR SELECT TO authenticated
  USING (public.is_arena_manager(auth.uid()));
CREATE POLICY "Admins manage input_boards"
  ON public.input_boards FOR ALL TO authenticated
  USING (public.is_arena_manager(auth.uid()))
  WITH CHECK (public.is_arena_manager(auth.uid()));

-- 9. arena_settings — public read kept, writes admin-only
CREATE POLICY "Public read arena_settings"
  ON public.arena_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage arena_settings"
  ON public.arena_settings FOR ALL TO authenticated
  USING (public.is_arena_manager(auth.uid()))
  WITH CHECK (public.is_arena_manager(auth.uid()));
