-- Etapa 10 — Notificações completas e preferências por categoria.

alter table public.community_notifications drop constraint if exists community_notifications_kind_check;
alter table public.community_notifications add constraint community_notifications_kind_check
check (kind in ('comment','reaction','report_resolved','event_status','listing_status','profile_follow','chat_message','chat_reply','chat_invite','followed_content'));

alter table public.community_notifications drop constraint if exists community_notifications_entity_type_check;
alter table public.community_notifications add constraint community_notifications_entity_type_check
check (entity_type in ('post','comment','report','event_submission','marketplace_listing','profile','chat_room'));

create table if not exists public.community_notification_preferences (
  profile_id uuid primary key references public.community_profiles(id) on delete cascade,
  messages boolean not null default true,
  interactions boolean not null default true,
  followers boolean not null default true,
  moderation boolean not null default true,
  followed_content boolean not null default true,
  invitations boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.community_notification_preferences enable row level security;
create policy "Members read notification preferences" on public.community_notification_preferences for select to authenticated using(profile_id=auth.uid());
create policy "Members insert notification preferences" on public.community_notification_preferences for insert to authenticated with check(profile_id=auth.uid());
create policy "Members update notification preferences" on public.community_notification_preferences for update to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
grant select,insert,update on public.community_notification_preferences to authenticated;

create or replace function public.notification_category_enabled(target_profile uuid, notification_kind text)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when notification_kind in ('chat_message','chat_reply') then coalesce(p.messages,true)
    when notification_kind in ('comment','reaction') then coalesce(p.interactions,true)
    when notification_kind='profile_follow' then coalesce(p.followers,true)
    when notification_kind in ('report_resolved','event_status','listing_status') then coalesce(p.moderation,true)
    when notification_kind='followed_content' then coalesce(p.followed_content,true)
    when notification_kind='chat_invite' then coalesce(p.invitations,true)
    else true end
  from (select 1) seed left join public.community_notification_preferences p on p.profile_id=target_profile;
$$;
revoke all on function public.notification_category_enabled(uuid,text) from public,anon,authenticated;

create or replace function public.filter_community_notification_preferences()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.notification_category_enabled(new.recipient_id,new.kind) then return null; end if;
  return new;
end; $$;
drop trigger if exists filter_community_notification_preferences on public.community_notifications;
create trigger filter_community_notification_preferences before insert on public.community_notifications
for each row execute function public.filter_community_notification_preferences();

create or replace function public.get_notification_preferences()
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); prefs public.community_notification_preferences%rowtype;
begin
  if uid is null then raise exception 'É necessário entrar'; end if;
  insert into public.community_notification_preferences(profile_id) values(uid) on conflict(profile_id) do nothing;
  select * into prefs from public.community_notification_preferences where profile_id=uid;
  return jsonb_build_object('messages',prefs.messages,'interactions',prefs.interactions,'followers',prefs.followers,'moderation',prefs.moderation,'followed_content',prefs.followed_content,'invitations',prefs.invitations);
end; $$;

create or replace function public.set_notification_preferences(new_preferences jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'É necessário entrar'; end if;
  insert into public.community_notification_preferences(profile_id,messages,interactions,followers,moderation,followed_content,invitations)
  values(uid,coalesce((new_preferences->>'messages')::boolean,true),coalesce((new_preferences->>'interactions')::boolean,true),coalesce((new_preferences->>'followers')::boolean,true),coalesce((new_preferences->>'moderation')::boolean,true),coalesce((new_preferences->>'followed_content')::boolean,true),coalesce((new_preferences->>'invitations')::boolean,true))
  on conflict(profile_id) do update set messages=excluded.messages,interactions=excluded.interactions,followers=excluded.followers,moderation=excluded.moderation,followed_content=excluded.followed_content,invitations=excluded.invitations,updated_at=now();
  return public.get_notification_preferences();
end; $$;
revoke all on function public.get_notification_preferences() from public,anon;
revoke all on function public.set_notification_preferences(jsonb) from public,anon;
grant execute on function public.get_notification_preferences() to authenticated;
grant execute on function public.set_notification_preferences(jsonb) to authenticated;

-- Novidades publicadas por perfis acompanhados.
create or replace function public.notify_followers_about_post()
returns trigger language plpgsql security definer set search_path=public as $$
declare follower uuid; author_name text;
begin
  if new.status<>'published' then return new; end if;
  select coalesce(artistic_name,display_name,'Um perfil que você acompanha') into author_name from public.community_profiles where id=new.author_id;
  for follower in select follower_id from public.community_profile_follows where followed_id=new.author_id loop
    insert into public.community_notifications(recipient_id,actor_id,kind,entity_type,entity_id,message)
    values(follower,new.author_id,'followed_content','post',new.id,author_name||' publicou uma novidade na comunidade.');
  end loop;
  return new;
end; $$;
drop trigger if exists notify_followers_about_post on public.community_posts;
create trigger notify_followers_about_post after insert on public.community_posts for each row execute function public.notify_followers_about_post();

-- Aviso quando outra pessoa inclui o perfil em uma conversa (não dispara no autoingresso).
create or replace function public.notify_chat_membership()
returns trigger language plpgsql security definer set search_path=public as $$
declare room_owner uuid; room_kind text; actor_name text;
begin
  select owner_id,room_type into room_owner,room_kind from public.chat_rooms where id=new.room_id;
  if new.profile_id=coalesce(auth.uid(),new.profile_id) then return new; end if;
  select coalesce(artistic_name,display_name,'Alguém') into actor_name from public.community_profiles where id=coalesce(auth.uid(),room_owner);
  insert into public.community_notifications(recipient_id,actor_id,kind,entity_type,entity_id,message)
  values(new.profile_id,coalesce(auth.uid(),room_owner),'chat_invite','chat_room',new.room_id,
    case when room_kind='direct' then actor_name||' iniciou uma conversa com você.' else actor_name||' adicionou você a uma conversa.' end);
  return new;
end; $$;
drop trigger if exists notify_chat_membership on public.chat_room_members;
create trigger notify_chat_membership after insert on public.chat_room_members for each row execute function public.notify_chat_membership();

-- A central consolidada de moderação passou a atualizar denúncias diretamente; restaura o aviso ao denunciante.
create or replace function public.notify_report_decision()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status is not distinct from old.status or new.status not in ('resolved','dismissed') then return new; end if;
  insert into public.community_notifications(recipient_id,actor_id,kind,entity_type,entity_id,message)
  values(new.reporter_id,new.resolved_by,'report_resolved','report',new.id,
    case when new.status='dismissed' then 'Sua denúncia foi analisada e encerrada.' else 'Sua denúncia foi analisada pela moderação.' end);
  return new;
end; $$;
drop trigger if exists notify_report_decision on public.community_reports;
create trigger notify_report_decision after update of status on public.community_reports for each row execute function public.notify_report_decision();
