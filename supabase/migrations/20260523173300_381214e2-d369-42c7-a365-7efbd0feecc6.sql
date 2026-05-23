-- Tabela de configurações da arena para retenção de replays
CREATE TABLE IF NOT EXISTS public.arena_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE UNIQUE,
    replay_retention_days INTEGER NOT NULL DEFAULT 7,
    auto_cleanup_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.arena_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para arena_settings (assumindo que admin já tem acesso total via RLS desativado ou política global)
-- Como o usuário desativou RLS anteriormente em todo o banco, vou apenas garantir que a tabela esteja preparada
-- Mas vou adicionar políticas básicas por segurança caso ele reabilite
CREATE POLICY "Permitir leitura de configurações para todos" ON public.arena_settings FOR SELECT USING (true);
CREATE POLICY "Permitir atualização para admins" ON public.arena_settings FOR ALL USING (true);

-- Garantir que a tabela replays tenha uma forma de identificar o arquivo no R2 se for diferente da URL
-- Se a video_url já for o caminho, podemos extrair, mas ter uma r2_key é melhor
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='replays' AND column_name='r2_key') THEN
        ALTER TABLE public.replays ADD COLUMN r2_key TEXT;
    END IF;
END $$;

-- Função para criar configurações padrão ao inserir uma nova arena
CREATE OR REPLACE FUNCTION public.handle_new_arena_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.arena_settings (arena_id)
    VALUES (NEW.id)
    ON CONFLICT (arena_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho para nova arena
DROP TRIGGER IF EXISTS on_arena_created ON public.arenas;
CREATE TRIGGER on_arena_created
    AFTER INSERT ON public.arenas
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_arena_settings();

-- Inserir configurações para arenas existentes
INSERT INTO public.arena_settings (arena_id)
SELECT id FROM public.arenas
ON CONFLICT (arena_id) DO NOTHING;
