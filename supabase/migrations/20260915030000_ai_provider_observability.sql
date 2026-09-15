-- Observabilidade dos provedores de IA.
-- Não armazena prompts, conteúdo bruto nem chaves. Registra somente metadados
-- operacionais suficientes para diagnosticar latência, fallback e falhas.

create table if not exists public.ai_provider_attempts (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  operation text not null check (operation in ('interpretation','complementary','transcription')),
  source_mode text not null check (source_mode in ('text','vision','audio')),
  provider text not null,
  model text,
  label text not null,
  attempt_order integer not null check (attempt_order >= 1),
  status text not null check (status in ('success','error')),
  duration_ms integer not null check (duration_ms >= 0),
  fallback_used boolean not null default false,
  retry_used boolean not null default false,
  error_message text,
  content_chars integer,
  media_count integer,
  created_at timestamptz not null default now()
);

comment on table public.ai_provider_attempts is
  'Trilha técnica das tentativas de IA. Não contém prompt nem conteúdo bruto; usada para diagnóstico de fallback, latência e disponibilidade.';

create index if not exists ai_provider_attempts_created_idx
  on public.ai_provider_attempts (created_at desc);
create index if not exists ai_provider_attempts_correlation_idx
  on public.ai_provider_attempts (correlation_id, attempt_order);
create index if not exists ai_provider_attempts_provider_status_idx
  on public.ai_provider_attempts (provider, status, created_at desc);

alter table public.ai_provider_attempts enable row level security;

-- A aplicação grava esta tabela apenas pelo cliente de serviço no servidor.
-- Usuários comuns não recebem INSERT/UPDATE/DELETE via RLS.
drop policy if exists "Moderators read AI provider observability" on public.ai_provider_attempts;
create policy "Moderators read AI provider observability"
on public.ai_provider_attempts
for select to authenticated
using (
  private.has_role(auth.uid(), 'admin')
  or private.has_role(auth.uid(), 'revisor')
);
