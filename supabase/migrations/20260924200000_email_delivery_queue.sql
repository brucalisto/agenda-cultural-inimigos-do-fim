-- Etapa 11: fila de entrega de notificacoes por e-mail.
-- O destinatario nao e persistido aqui; o worker backend resolve o e-mail pelo recipient_id.

create table if not exists public.email_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid unique not null references public.community_notifications(id) on delete cascade,
  recipient_id uuid not null references public.community_profiles(id) on delete cascade,
  subject text not null,
  body_text text not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_delivery_queue_pending_idx on public.email_delivery_queue(status,next_attempt_at);
alter table public.email_delivery_queue enable row level security;
revoke all on public.email_delivery_queue from public,anon,authenticated;

create or replace function public.notification_email_subject(k text)
returns text language sql immutable as $$
 select case
  when k in ('chat_message','chat_reply') then 'Nova mensagem no Inimigos do Fim'
  when k='comment' then 'Novo comentario na comunidade'
  when k='reaction' then 'Nova interacao na sua publicacao'
  when k='profile_follow' then 'Novo seguidor no Inimigos do Fim'
  when k='followed_content' then 'Novidade de um perfil que voce acompanha'
  when k='chat_invite' then 'Voce foi incluido em uma conversa'
  when k='event_status' then 'Atualizacao sobre seu evento'
  when k='listing_status' then 'Atualizacao sobre seu anuncio'
  when k='report_resolved' then 'Atualizacao da moderacao'
  else 'Voce tem uma novidade no Inimigos do Fim' end;
$$;

create or replace function public.queue_notification_email()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.email_delivery_queue(notification_id,recipient_id,subject,body_text)
  values(new.id,new.recipient_id,public.notification_email_subject(new.kind),new.message)
  on conflict(notification_id) do nothing;
  return new;
end; $$;
drop trigger if exists queue_notification_email on public.community_notifications;
create trigger queue_notification_email after insert on public.community_notifications
for each row execute function public.queue_notification_email();

create or replace function public.claim_email_delivery_batch(batch_size integer default 20)
returns setof public.email_delivery_queue language plpgsql security definer set search_path=public as $$
begin
 if auth.role()<>'service_role' then raise exception 'Acesso restrito ao backend'; end if;
 return query
 with candidates as (
   select q.id from public.email_delivery_queue q
   where (q.status='pending' or (q.status='processing' and q.locked_at < now()-interval '10 minutes'))
     and q.next_attempt_at<=now() and q.attempts<5
   order by q.created_at asc
   for update skip locked
   limit greatest(1,least(batch_size,50))
 ), updated as (
   update public.email_delivery_queue q
   set status='processing',locked_at=now(),attempts=q.attempts+1,updated_at=now()
   from candidates c where q.id=c.id returning q.*
 ) select * from updated;
end; $$;

create or replace function public.complete_email_delivery(queue_id uuid, success boolean, error_message text default null, external_message_id text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.role()<>'service_role' then raise exception 'Acesso restrito ao backend'; end if;
 update public.email_delivery_queue set
   status=case when success then 'sent' when attempts>=5 then 'failed' else 'pending' end,
   sent_at=case when success then now() else sent_at end,
   provider_message_id=coalesce(external_message_id,provider_message_id),
   last_error=case when success then null else left(coalesce(error_message,'Falha desconhecida'),2000) end,
   next_attempt_at=case when success then next_attempt_at else now()+make_interval(mins=>least(60,5*greatest(attempts,1))) end,
   locked_at=null,updated_at=now()
 where id=queue_id;
end; $$;

revoke all on function public.claim_email_delivery_batch(integer) from public,anon,authenticated;
revoke all on function public.complete_email_delivery(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.claim_email_delivery_batch(integer) to service_role;
grant execute on function public.complete_email_delivery(uuid,boolean,text,text) to service_role;

create or replace function public.get_email_delivery_stats()
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null or not exists(select 1 from public.admin_users where id=uid) then raise exception 'Acesso administrativo necessario'; end if;
 select jsonb_build_object(
  'pending',count(*) filter(where status='pending'),
  'processing',count(*) filter(where status='processing'),
  'sent',count(*) filter(where status='sent'),
  'failed',count(*) filter(where status='failed'),
  'last_sent_at',max(sent_at)
 ) into result from public.email_delivery_queue;
 return result;
end; $$;
revoke all on function public.get_email_delivery_stats() from public,anon;
grant execute on function public.get_email_delivery_stats() to authenticated;
