-- Interação comunitária: comentários, reações, denúncias e notificações.

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.community_profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  status text not null default 'published' check (status in ('published','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_post_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  profile_id uuid not null references public.community_profiles(id) on delete cascade,
  reaction text not null default 'apoio' check (reaction in ('apoio')),
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.community_profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('post','comment')),
  entity_id uuid not null,
  reason text not null check (reason in ('spam','assédio','discurso_de_ódio','conteúdo_impróprio','informação_falsa','outro')),
  details text check (details is null or char_length(details) <= 1500),
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  resolution_notes text,
  resolved_by uuid references public.community_profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, entity_type, entity_id)
);

create table if not exists public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.community_profiles(id) on delete cascade,
  actor_id uuid references public.community_profiles(id) on delete set null,
  kind text not null check (kind in ('comment','reaction','report_resolved')),
  entity_type text not null check (entity_type in ('post','comment','report')),
  entity_id uuid not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.community_post_comments enable row level security;
alter table public.community_post_reactions enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_notifications enable row level security;

create index if not exists community_comments_post_created_idx
  on public.community_post_comments (post_id, created_at);
create index if not exists community_reactions_post_idx
  on public.community_post_reactions (post_id, created_at);
create index if not exists community_reports_status_created_idx
  on public.community_reports (status, created_at);
create index if not exists community_notifications_recipient_unread_idx
  on public.community_notifications (recipient_id, read_at, created_at desc);

create policy "Visible post comments are readable"
on public.community_post_comments for select
using (
  status = 'published'
  and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published')
);

create policy "Members create comments"
on public.community_post_comments for insert to authenticated
with check (
  author_id = auth.uid()
  and status = 'published'
  and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published')
);

create policy "Authors remove own comments"
on public.community_post_comments for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid() and status in ('published','removed'));

create policy "Moderators manage comments"
on public.community_post_comments for all to authenticated
using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'))
with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'));

create policy "Visible post reactions are readable"
on public.community_post_reactions for select
using (exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published'));

create policy "Members add own reactions"
on public.community_post_reactions for insert to authenticated
with check (
  profile_id = auth.uid()
  and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published')
);

create policy "Members remove own reactions"
on public.community_post_reactions for delete to authenticated
using (profile_id = auth.uid());

create policy "Members create own reports"
on public.community_reports for insert to authenticated
with check (
  reporter_id = auth.uid()
  and status = 'pending'
  and (
    (entity_type = 'post' and exists (
      select 1 from public.community_posts p where p.id = entity_id and p.status = 'published'
    ))
    or
    (entity_type = 'comment' and exists (
      select 1 from public.community_post_comments c where c.id = entity_id and c.status = 'published'
    ))
  )
);

create policy "Members read own reports"
on public.community_reports for select to authenticated
using (reporter_id = auth.uid());

create policy "Moderators manage reports"
on public.community_reports for all to authenticated
using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'))
with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'));

create policy "Members read own notifications"
on public.community_notifications for select to authenticated
using (recipient_id = auth.uid());

create policy "Members update own notifications"
on public.community_notifications for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create or replace function public.protect_community_member_updates()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor') then
    return new;
  end if;
  if tg_table_name = 'community_post_comments' then
    if old.author_id <> auth.uid()
       or new.id is distinct from old.id
       or new.post_id is distinct from old.post_id
       or new.author_id is distinct from old.author_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Campos protegidos do comentário não podem ser alterados';
    end if;
  elsif tg_table_name = 'community_notifications' then
    if old.recipient_id <> auth.uid()
       or new.id is distinct from old.id
       or new.recipient_id is distinct from old.recipient_id
       or new.actor_id is distinct from old.actor_id
       or new.kind is distinct from old.kind
       or new.entity_type is distinct from old.entity_type
       or new.entity_id is distinct from old.entity_id
       or new.message is distinct from old.message
       or new.created_at is distinct from old.created_at then
      raise exception 'Somente o estado de leitura da notificação pode ser alterado';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_community_member_updates() from public, anon;
grant execute on function public.protect_community_member_updates() to authenticated;

create trigger protect_community_comment_updates
before update on public.community_post_comments
for each row execute function public.protect_community_member_updates();

create trigger protect_community_notification_updates
before update on public.community_notifications
for each row execute function public.protect_community_member_updates();

create or replace function public.notify_community_interaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare post_author uuid;
begin
  select author_id into post_author
  from public.community_posts
  where id = new.post_id;

  if post_author is null then return new; end if;

  if tg_table_name = 'community_post_comments' and post_author <> new.author_id then
    insert into public.community_notifications
      (recipient_id, actor_id, kind, entity_type, entity_id, message)
    values
      (post_author, new.author_id, 'comment', 'post', new.post_id, 'Alguém comentou na sua publicação.');
  elsif tg_table_name = 'community_post_reactions' and post_author <> new.profile_id then
    insert into public.community_notifications
      (recipient_id, actor_id, kind, entity_type, entity_id, message)
    values
      (post_author, new.profile_id, 'reaction', 'post', new.post_id, 'Alguém apoiou sua publicação.');
  end if;
  return new;
end;
$$;

revoke all on function public.notify_community_interaction() from public, anon, authenticated;

drop trigger if exists notify_on_community_comment on public.community_post_comments;
create trigger notify_on_community_comment
after insert on public.community_post_comments
for each row execute function public.notify_community_interaction();

drop trigger if exists notify_on_community_reaction on public.community_post_reactions;
create trigger notify_on_community_reaction
after insert on public.community_post_reactions
for each row execute function public.notify_community_interaction();

create or replace function public.mark_community_notifications_read()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare affected integer;
begin
  update public.community_notifications
  set read_at = now()
  where recipient_id = auth.uid() and read_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.mark_community_notifications_read() from public, anon;
grant execute on function public.mark_community_notifications_read() to authenticated;

create or replace function public.moderate_community_report(
  report_id uuid,
  decision text,
  notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare target public.community_reports%rowtype;
begin
  if not (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor')) then
    raise exception 'Acesso negado';
  end if;
  if decision not in ('resolved','dismissed','remove_content') then
    raise exception 'Decisão inválida';
  end if;

  select * into target from public.community_reports where id = report_id for update;
  if not found then raise exception 'Denúncia não encontrada'; end if;

  if decision = 'remove_content' then
    if target.entity_type = 'post' then
      update public.community_posts set status = 'removed', updated_at = now() where id = target.entity_id;
    elsif target.entity_type = 'comment' then
      update public.community_post_comments set status = 'removed', updated_at = now() where id = target.entity_id;
    end if;
  end if;

  update public.community_reports
  set status = case when decision = 'dismissed' then 'dismissed' else 'resolved' end,
      resolution_notes = notes,
      resolved_by = auth.uid(),
      resolved_at = now()
  where id = report_id;

  insert into public.community_notifications
    (recipient_id, actor_id, kind, entity_type, entity_id, message)
  values
    (target.reporter_id, auth.uid(), 'report_resolved', 'report', report_id,
     case when decision = 'dismissed'
       then 'Sua denúncia foi analisada e encerrada.'
       else 'Sua denúncia foi analisada pela moderação.' end);
end;
$$;

revoke all on function public.moderate_community_report(uuid,text,text) from public, anon;
grant execute on function public.moderate_community_report(uuid,text,text) to authenticated;

-- Limites simples para comentários e denúncias, executados no banco.
create or replace function public.enforce_community_engagement_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare actor uuid := auth.uid(); recent_count integer;
begin
  if actor is null or private.has_role(actor,'admin') or private.has_role(actor,'revisor') then return new; end if;
  perform pg_advisory_xact_lock(hashtext(tg_table_name || ':' || actor::text)::bigint);
  new.created_at := now();
  if tg_table_name = 'community_post_comments' then
    select count(*) into recent_count from public.community_post_comments
      where author_id = actor and created_at >= now() - interval '1 minute';
    if recent_count >= 12 then raise exception 'Muitos comentários em sequência. Aguarde um minuto.'; end if;
  elsif tg_table_name = 'community_reports' then
    select count(*) into recent_count from public.community_reports
      where reporter_id = actor and created_at >= now() - interval '1 hour';
    if recent_count >= 10 then raise exception 'Limite temporário de denúncias atingido.'; end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_community_engagement_rate_limit() from public, anon;
grant execute on function public.enforce_community_engagement_rate_limit() to authenticated;

create trigger rate_limit_community_comments before insert on public.community_post_comments
for each row execute function public.enforce_community_engagement_rate_limit();
create trigger rate_limit_community_reports before insert on public.community_reports
for each row execute function public.enforce_community_engagement_rate_limit();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'community_post_comments'
  ) then alter publication supabase_realtime add table public.community_post_comments; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'community_post_reactions'
  ) then alter publication supabase_realtime add table public.community_post_reactions; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'community_notifications'
  ) then alter publication supabase_realtime add table public.community_notifications; end if;
end $$;
