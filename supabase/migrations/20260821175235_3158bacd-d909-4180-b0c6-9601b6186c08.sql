-- 1. Tabela interpreted_contents
CREATE TABLE IF NOT EXISTS public.interpreted_contents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE UNIQUE,
    title text,
    category text,
    summary text,
    full_description text,
    event_date timestamp with time zone,
    location text,
    price text,
    contact_name text,
    contact_phone text,
    source_url text,
    keywords text[],
    extracted_data jsonb,
    missing_fields text[],
    warnings text[],
    confidence_score float,
    model_used text,
    prompt_version text,
    review_status text DEFAULT 'pendente',
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Tabela publication_destinations
CREATE TABLE IF NOT EXISTS public.publication_destinations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    provider text,
    endpoint_url text,
    enabled boolean DEFAULT true,
    field_mapping jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Tabela publication_records
CREATE TABLE IF NOT EXISTS public.publication_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interpreted_content_id uuid REFERENCES public.interpreted_contents(id) ON DELETE CASCADE,
    destination_id uuid REFERENCES public.publication_destinations(id) ON DELETE CASCADE,
    status text,
    external_record_id text,
    request_payload jsonb,
    response_payload jsonb,
    error_message text,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interpreted_contents TO authenticated;
GRANT ALL ON public.interpreted_contents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_destinations TO authenticated;
GRANT ALL ON public.publication_destinations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_records TO authenticated;
GRANT ALL ON public.publication_records TO service_role;

-- 5. RLS
ALTER TABLE public.interpreted_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_records ENABLE ROW LEVEL SECURITY;

-- interpreted_contents policies
CREATE POLICY "Admins can manage interpreted contents" ON public.interpreted_contents
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Revisors can view and edit interpreted contents" ON public.interpreted_contents
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'revisor'));

-- publication_destinations policies
CREATE POLICY "Admins can manage destinations" ON public.publication_destinations
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Revisors can view destinations" ON public.publication_destinations
    FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'revisor'));

-- publication_records policies
CREATE POLICY "Admins can manage publication records" ON public.publication_records
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Revisors can view publication records" ON public.publication_records
    FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'revisor'));
