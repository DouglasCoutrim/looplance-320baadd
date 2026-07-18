-- YouTube Live Streaming Support for Arenas
--
-- Tabelas para armazenar credenciais OAuth do YouTube por arena
-- e o registro de transmissões ao vivo (broadcasts).

-- 1. arena_youtube_credentials
CREATE TABLE IF NOT EXISTS public.arena_youtube_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    youtube_channel_id TEXT,
    access_token TEXT,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(arena_id)
);

ALTER TABLE public.arena_youtube_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arena_youtube_credentials_select_own"
    ON public.arena_youtube_credentials
    FOR SELECT
    USING (
        public.is_super_admin()
        OR arena_id = (SELECT arena_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "arena_youtube_credentials_insert_own"
    ON public.arena_youtube_credentials
    FOR INSERT
    WITH CHECK (
        public.is_super_admin()
        OR arena_id = (SELECT arena_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "arena_youtube_credentials_update_own"
    ON public.arena_youtube_credentials
    FOR UPDATE
    USING (
        public.is_super_admin()
        OR arena_id = (SELECT arena_id FROM public.profiles WHERE id = auth.uid())
    );

GRANT SELECT, INSERT, UPDATE ON public.arena_youtube_credentials TO authenticated;
GRANT ALL ON public.arena_youtube_credentials TO service_role;

-- 2. live_broadcasts
CREATE TABLE IF NOT EXISTS public.live_broadcasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    quadra_id UUID REFERENCES public.quadras(id),
    camera_id UUID REFERENCES public.cameras(id),
    youtube_broadcast_id TEXT,
    youtube_stream_id TEXT,
    stream_key TEXT,
    video_id TEXT,
    status TEXT NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'testing', 'active', 'completed', 'stopped', 'error')),
    privacy_status TEXT DEFAULT 'public',
    scheduled_start_time TIMESTAMPTZ DEFAULT now(),
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.live_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_broadcasts_select"
    ON public.live_broadcasts
    FOR SELECT
    USING (
        public.is_super_admin()
        OR arena_id = (SELECT arena_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.edge_devices ed
            WHERE ed.id = current_setting('request.header.x-edge-device-id', true)::uuid
            AND ed.arena_id = live_broadcasts.arena_id
        )
    );

CREATE POLICY "live_broadcasts_insert"
    ON public.live_broadcasts
    FOR INSERT
    WITH CHECK (
        public.is_super_admin()
        OR arena_id = (SELECT arena_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "live_broadcasts_update"
    ON public.live_broadcasts
    FOR UPDATE
    USING (
        public.is_super_admin()
        OR arena_id = (SELECT arena_id FROM public.profiles WHERE id = auth.uid())
    );

GRANT SELECT, INSERT, UPDATE ON public.live_broadcasts TO authenticated;
GRANT ALL ON public.live_broadcasts TO service_role;

-- 3. Indices
CREATE INDEX IF NOT EXISTS idx_live_broadcasts_arena_id ON public.live_broadcasts(arena_id);
CREATE INDEX IF NOT EXISTS idx_live_broadcasts_status ON public.live_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_live_broadcasts_arena_status ON public.live_broadcasts(arena_id, status);

-- 4. Função auxiliar: fn_get_active_youtube_broadcast
CREATE OR REPLACE FUNCTION public.fn_get_active_youtube_broadcast(p_arena_id UUID)
RETURNS SETOF public.live_broadcasts
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT * FROM public.live_broadcasts
    WHERE arena_id = p_arena_id
      AND status IN ('created', 'testing', 'active')
    ORDER BY created_at DESC
    LIMIT 1;
$$;

-- 5. Trigger: atualizar updated_at em live_broadcasts
CREATE OR REPLACE FUNCTION public.fn_update_live_broadcasts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_broadcasts_updated_at ON public.live_broadcasts;
CREATE TRIGGER trg_live_broadcasts_updated_at
    BEFORE UPDATE ON public.live_broadcasts
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_live_broadcasts_updated_at();

-- 6. Trigger: atualizar updated_at em arena_youtube_credentials
CREATE OR REPLACE FUNCTION public.fn_update_arena_youtube_credentials_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_arena_youtube_credentials_updated_at ON public.arena_youtube_credentials;
CREATE TRIGGER trg_arena_youtube_credentials_updated_at
    BEFORE UPDATE ON public.arena_youtube_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_arena_youtube_credentials_updated_at();

-- 7. Habilitar Realtime para live_broadcasts
alter publication supabase_realtime add table public.live_broadcasts;
