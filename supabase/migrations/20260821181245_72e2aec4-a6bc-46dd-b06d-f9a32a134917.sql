-- Enum for automation action types
CREATE TYPE public.automation_action_type AS ENUM (
    'apenas_registrar',
    'sinalizar',
    'ignorar',
    'enviar_para_revisao',
    'aprovar',
    'publicar',
    'responder',
    'solicitar_exclusao'
);

-- Automation Rules Table
CREATE TABLE public.automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    conditions JSONB DEFAULT '{}'::jsonb,
    action_type public.automation_action_type NOT NULL,
    action_config JSONB DEFAULT '{}'::jsonb,
    requires_approval BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Automation Actions (History/Logs)
CREATE TABLE public.automation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES public.automation_rules(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
    action_type public.automation_action_type NOT NULL,
    execution_mode public.automation_mode NOT NULL,
    status TEXT NOT NULL,
    request_payload JSONB DEFAULT '{}'::jsonb,
    response_payload JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Admin Audit Table (Simple implementation)
CREATE TABLE public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;

GRANT ALL ON public.automation_actions TO authenticated;
GRANT ALL ON public.automation_actions TO service_role;

GRANT ALL ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

-- RLS Policies
-- Admins can do everything
CREATE POLICY "Admins have full access to automation_rules"
ON public.automation_rules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins have full access to automation_actions"
ON public.automation_actions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins have full access to admin_audit_logs"
ON public.admin_audit_logs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Revisors can read rules and actions
CREATE POLICY "Revisors can select automation_rules"
ON public.automation_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'revisor'));

CREATE POLICY "Revisors can select automation_actions"
ON public.automation_actions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'revisor'));
