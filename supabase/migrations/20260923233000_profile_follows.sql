-- Conexões entre perfis culturais, com notificações privadas para quem recebe o novo seguidor.
create table if not exists public.community_profile_follows (
  follower_id uuid not null references public.community_profiles(id) on delete cascade,
  followed_id uuid not null references public.community_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint community_profile_follows_not_self check (follower_id <> followed_id)
);

alter table public.community_profile_follows enable row level security;

drop policy if exists "Anyone views follows of public profiles" on public.community_profile_follows;
create policy "Anyone views follows of public profiles"
  on public.community_profile_follows for select
  using (
    exists (
      select 1 from public.community_profiles profile
      where profile.id = followed_id and profile.visibility = 'public'
    )
  );

drop policy if exists "Members follow public profiles" on public.community_profile_follows;
create policy "Members follow public profiles"
  on public.community_profile_follows for insert to authenticated
  with check (
    follower_id = auth.uid()
    and follower_id <> followed_id
    and exists (
      select 1 from public.community_profiles profile
      where profile.id = followed_id and profile.visibility = 'public'
    )
  );

drop policy if exists "Members unfollow profiles" on public.community_profile_follows;
create policy "Members unfollow profiles"
  on public.community_profile_follows for delete to authenticated
  using (follower_id = auth.uid());

grant select on public.community_profile_follows to anon, authenticated;
grant insert, delete on public.community_profile_follows to authenticated;
grant all on public.community_profile_follows to service_role;

create index if not exists community_profile_follows_followed_idx
  on public.community_profile_follows (followed_id, created_at desc);
create index if not exists community_profile_follows_follower_idx
  on public.community_profile_follows (follower_id, created_at desc);

alter table public.community_notifications
  drop constraint if exists community_notifications_kind_check;
alter table public.community_notifications
  add constraint community_notifications_kind_check
  check (kind in ('comment','reaction','report_resolved','event_status','listing_status','profile_follow'));

alter table public.community_notifications
  drop constraint if exists community_notifications_entity_type_check;
alter table public.community_notifications
  add constraint community_notifications_entity_type_check
  check (entity_type in ('post','comment','report','event_submission','marketplace_listing','profile'));

create or replace function public.notify_profile_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  follower_name text;
begin
  select coalesce(artistic_name, display_name, 'Alguém da comunidade')
    into follower_name
  from public.community_profiles
  where id = new.follower_id;

  insert into public.community_notifications
    (recipient_id, actor_id, kind, entity_type, entity_id, message)
  values
    (new.followed_id, new.follower_id, 'profile_follow', 'profile', new.follower_id,
     follower_name || ' começou a acompanhar seu perfil.');
  return new;
end;
$$;

revoke all on function public.notify_profile_follow() from public, anon, authenticated;

drop trigger if exists notify_profile_follow_insert on public.community_profile_follows;
create trigger notify_profile_follow_insert
after insert on public.community_profile_follows
for each row execute function public.notify_profile_follow();
