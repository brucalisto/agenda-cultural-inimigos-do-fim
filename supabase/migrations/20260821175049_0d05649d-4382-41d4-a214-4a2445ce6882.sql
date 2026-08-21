DO $$ BEGIN
    CREATE TYPE public.automation_mode AS ENUM ('monitorar', 'simular', 'executar');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.processing_status AS ENUM ('recebido', 'pendente', 'processando', 'interpretado', 'necessita_revisao', 'aprovado', 'publicado', 'ignorado', 'erro');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.app_role;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS public.whatsapp_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_group_id text UNIQUE NOT NULL,
    nome text NOT NULL,
    descricao text,
    ativo boolean DEFAULT true,
    autorizado boolean DEFAULT false,
    automation_mode public.automation_mode DEFAULT 'monitorar',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_message_id text UNIQUE NOT NULL,
    group_id uuid REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
    sender_external_id text NOT NULL,
    sender_name text,
    message_type text,
    text_content text,
    caption text,
    quoted_message_id text,
    occurred_at timestamp with time zone,
    received_at timestamp with time zone DEFAULT now(),
    raw_payload jsonb,
    processing_status public.processing_status DEFAULT 'recebido',
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
    media_type text,
    original_filename text,
    mime_type text,
    file_size bigint,
    storage_path text,
    source_url text,
    checksum text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extracted_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
    original_url text,
    normalized_url text,
    page_title text,
    page_description text,
    extracted_text text,
    extraction_status text,
    failure_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_groups TO authenticated;
GRANT ALL ON public.whatsapp_groups TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_media TO authenticated;
GRANT ALL ON public.message_media TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extracted_links TO authenticated;
GRANT ALL ON public.extracted_links TO service_role;

ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage groups" ON public.whatsapp_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Revisors can view groups" ON public.whatsapp_groups FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'revisor'));

CREATE POLICY "Admins can manage messages" ON public.whatsapp_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Revisors can view messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'revisor'));

CREATE POLICY "Admins can manage media" ON public.message_media FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Revisors can view media" ON public.message_media FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'revisor'));

CREATE POLICY "Admins can manage links" ON public.extracted_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Revisors can view links" ON public.extracted_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'revisor'));
