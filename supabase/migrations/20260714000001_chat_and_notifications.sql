-- Migration: Chat (messages) + Notificacoes in-app
-- Adiciona suporte a mensagens diretas e notificacoes com som.

-- ══════════════════════════════════════════════════════════════════════
-- 1. MESSAGES
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios autenticados podem ver mensagens onde sao sender ou receiver
CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Policy: usuario pode inserir mensagens como sender
CREATE POLICY "messages_insert_own"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Policy: usuario pode marcar como lido mensagens onde eh receiver
CREATE POLICY "messages_update_read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id AND read = true);

-- Indices
CREATE INDEX messages_participant_idx
  ON public.messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX messages_receiver_unread_idx
  ON public.messages (receiver_id, read) WHERE read = false;


-- ══════════════════════════════════════════════════════════════════════
-- 2. NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'like', 'comment', 'follow', 'replay')),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,                       -- dados adicionais (ex: { replay_id, sender_id, comment_id })
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: usuario ve apenas suas proprias notificacoes
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: service_role pode inserir notificacoes (via trigger)
CREATE POLICY "notifications_insert_service"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: usuario pode marcar como lida
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND read = true);

-- Indices
CREATE INDEX notifications_user_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id, read) WHERE read = false;


-- ══════════════════════════════════════════════════════════════════════
-- 3. TRIGGERS: notificacoes automaticas
-- ══════════════════════════════════════════════════════════════════════

-- 3a. Notificacao ao receber mensagem
CREATE OR REPLACE FUNCTION public.handle_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT COALESCE(full_name, 'Alguem') INTO sender_name
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

CREATE TRIGGER trg_message_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_message_notification();


-- 3b. Notificacao ao receber like
CREATE OR REPLACE FUNCTION public.handle_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  liker_name TEXT;
  replay_owner_id UUID;
BEGIN
  SELECT COALESCE(full_name, 'Alguem') INTO liker_name
  FROM public.profiles WHERE id = NEW.user_id;

  IF NEW.target_type = 'replay' THEN
    SELECT user_id INTO replay_owner_id
    FROM public.replays WHERE id = NEW.target_id;
    IF replay_owner_id IS NULL OR replay_owner_id = NEW.user_id THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      replay_owner_id,
      'like',
      'Nova curtida',
      liker_name || ' curtiu seu lance',
      jsonb_build_object('replay_id', NEW.target_id, 'liker_id', NEW.user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_like_notification
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_like_notification();


-- 3c. Notificacao ao receber comentario
CREATE OR REPLACE FUNCTION public.handle_comment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  commenter_name TEXT;
  replay_owner_id UUID;
BEGIN
  SELECT COALESCE(full_name, 'Alguem') INTO commenter_name
  FROM public.profiles WHERE id = NEW.user_id;

  IF NEW.target_type = 'replay' THEN
    SELECT user_id INTO replay_owner_id
    FROM public.replays WHERE id = NEW.target_id;
    IF replay_owner_id IS NULL OR replay_owner_id = NEW.user_id THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      replay_owner_id,
      'comment',
      'Novo comentario',
      commenter_name || ': ' || LEFT(NEW.content, 100),
      jsonb_build_object('replay_id', NEW.target_id, 'comment_id', NEW.id, 'commenter_id', NEW.user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_comment_notification
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_notification();


-- 3d. Notificacao ao receber follow
CREATE OR REPLACE FUNCTION public.handle_follow_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  follower_name TEXT;
BEGIN
  SELECT COALESCE(full_name, 'Alguem') INTO follower_name
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

CREATE TRIGGER trg_follow_notification
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_follow_notification();


-- ══════════════════════════════════════════════════════════════════════
-- 4. STORAGE BUCKET para sons (notificacao)
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('som', 'som', true, 5242880, ARRAY['audio/mpeg', 'audio/mp3'])
ON CONFLICT (id) DO NOTHING;

-- Policy: leitura publica do bucket som
CREATE POLICY "som_public_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'som');

-- Policy: upload apenas para admins/service_role
CREATE POLICY "som_admin_insert"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'som');


-- ══════════════════════════════════════════════════════════════════════
-- 5. GRANT PERMISSIONS
-- ══════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT UPDATE (read) ON public.messages TO authenticated;
GRANT SELECT, UPDATE (read) ON public.notifications TO authenticated;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.notifications TO service_role;
