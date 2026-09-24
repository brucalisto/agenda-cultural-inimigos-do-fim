-- Etapa 8 — Central consolidada de moderação.
-- Normaliza o ciclo das denúncias e registra toda decisão sensível em auditoria.

alter table public.community_reports
  add column if not exists assigned_to uuid references public.admin_users(id) on delete set null,
  add column if not exists resolution_notes text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.admin_users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists community_reports_moderation_queue_idx
  on public.community_reports(status, created_at desc);

create or replace function public.moderate_community_report(
  target_report_id uuid,
  decision text,
  notes text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  report_row public.community_reports%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.admin_users where id=auth.uid()) then
    raise exception 'Acesso administrativo necessário';
  end if;
  if decision not in ('pending','resolved','dismissed') then
    raise exception 'Decisão de moderação inválida';
  end if;

  select * into report_row from public.community_reports where id=target_report_id for update;
  if not found then raise exception 'Denúncia não encontrada'; end if;

  update public.community_reports
  set status=decision,
      resolution_notes=nullif(trim(coalesce(notes,'')),''),
      assigned_to=case when decision='pending' then auth.uid() else assigned_to end,
      resolved_at=case when decision in ('resolved','dismissed') then now() else null end,
      resolved_by=case when decision in ('resolved','dismissed') then auth.uid() else null end,
      updated_at=now()
  where id=target_report_id;

  insert into public.community_safety_audit(actor_id,action,target_type,target_id,metadata)
  values(
    auth.uid(),
    'report_'||decision,
    report_row.entity_type,
    report_row.entity_id,
    jsonb_build_object('report_id',target_report_id,'notes',nullif(trim(coalesce(notes,'')),''))
  );
end;
$$;

revoke all on function public.moderate_community_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.moderate_community_report(uuid,text,text) to authenticated;

-- Administradores precisam enxergar a fila completa; usuários continuam restritos pelas políticas já existentes.
drop policy if exists "Admins read community reports" on public.community_reports;
create policy "Admins read community reports" on public.community_reports
for select using (exists(select 1 from public.admin_users where id=auth.uid()));
