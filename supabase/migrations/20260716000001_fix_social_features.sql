-- ============================================================================
-- Migration: Fix Social Features
-- Corrige 4 bugs relatados:
--   1. Usuários não aparecem / follow não persiste
--   2. Sem alerta de novas mensagens no chat
--   3. Não consegue comentar lances
--   4. Seguir aparece só na hora
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. PUBLICAR TABELAS NO REALTIME (para notificações, chat, comentários, etc.)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;       EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;       EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;          EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;        EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;       EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.messages       REPLICA IDENTITY FULL;
ALTER TABLE public.notifications  REPLICA IDENTITY FULL;
ALTER TABLE public.comments       REPLICA IDENTITY FULL;
ALTER TABLE public.likes          REPLICA IDENTITY FULL;
ALTER TABLE public.follows        REPLICA IDENTITY FULL;
ALTER TABLE public.profiles       REPLICA IDENTITY FULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. GARANTIR FK DE PROFILES PARA AUTH.USERS
--    (profiles.id DEVE referenciar auth.users.id para joins funcionarem)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'profiles'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name IN (
        SELECT kcu.constraint_name
        FROM information_schema.key_column_usage kcu
        WHERE kcu.table_schema = 'public'
          AND kcu.table_name = 'profiles'
          AND kcu.column_name = 'id'
      )
      AND tc.constraint_name IN (
        SELECT rc.constraint_name
        FROM information_schema.referential_constraints rc
        WHERE rc.unique_constraint_schema = 'auth'
          AND rc.constraint_schema = 'public'
      )
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_auth_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. CRIAR PROFILES PARA USUÁRIOS ÓRFÃOS
--    Usuários que existiam ANTES da trigger handle_new_user ser instalada
--    não têm registro em profiles. Isso quebra follows (FK) e SocialShell.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.profiles (id, email, full_name)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Usuário')
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. ADICIONAR FK DE COMMENTS.USER_ID → PROFILES.ID
--    Antes: comments.user_id → auth.users(id)
--    Depois: comments.user_id → profiles(id)
--    Necessário para o embedded join `profiles:user_id(...)` no Supabase JS
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_user_id_fkey,
  ADD CONSTRAINT comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Mesmo para likes (embora não use join hoje, por consistência)
ALTER TABLE public.likes
  DROP CONSTRAINT IF EXISTS likes_user_id_fkey,
  ADD CONSTRAINT likes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Mesmo para reports
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey,
  ADD CONSTRAINT reports_reporter_id_fkey
    FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. CORRIGIR POLÍTICA INSERT DE NOTIFICATIONS
--    A trigger handle_message_notification (SECURITY DEFINER) insere na
--    tabela, mas a policy só permite service_role. Adicionamos permissão
--    para authenticated (a trigger roda no contexto do usuário autenticado).
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "notifications_insert_service" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;

CREATE POLICY "notifications_insert_authenticated"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Mantém também para service_role
CREATE POLICY "notifications_insert_service"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. PERMITIR UPDATE DE NOTIFICATIONS PELO PROPRIETÁRIO
--    (já existe mas reforçamos para garantir)
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND read = true);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. GARANTIR QUE TODAS AS TABELAS DE SOCIAL TÊM RLS CORRETO
-- ════════════════════════════════════════════════════════════════════════════

-- follows: já existe, só reafirmamos
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- messages: garantir que o remetente também possa ver o que enviou
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. RECOMPILAR TRIGGERS DE NOTIFICAÇÃO PARA GARANTIR QUE FUNCIONAM
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT COALESCE(full_name, 'Alguém') INTO sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.receiver_id,
    'message',
    'Nova mensagem',
    sender_name || ': ' || LEFT(NEW.content, 100),
    jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_follow_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  follower_name TEXT;
BEGIN
  SELECT COALESCE(full_name, 'Alguém') INTO follower_name
  FROM public.profiles WHERE id = NEW.follower_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.following_id,
    'follow',
    'Novo seguidor',
    follower_name || ' começou a seguir você',
    jsonb_build_object('follower_id', NEW.follower_id)
  );
  RETURN NEW;
END;
$$;
