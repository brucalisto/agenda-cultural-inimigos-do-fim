-- 1. Tabela webhook_events
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text DEFAULT 'evolution',
    event_type text,
    external_event_id text,
    headers_sanitized jsonb,
    payload jsonb,
    processing_status text,
    processing_duration_ms integer,
    http_status integer,
    error_message text,
    received_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone
);

-- 2. Grants
GRANT SELECT, INSERT, UPDATE ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;

-- 3. RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view webhook logs" ON public.webhook_events
    FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- service_role (used by edge functions/server routes) can do everything
-- This is implicit, but policies apply to authenticated
