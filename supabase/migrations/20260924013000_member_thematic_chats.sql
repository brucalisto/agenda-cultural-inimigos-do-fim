-- Conversas temáticas criadas por membros entram em revisão antes de ficarem abertas.
-- O criador participa automaticamente da sala e pode acompanhar o status.

alter table public.chat_rooms
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending','approved','rejected')),
  add column if not exists moderation_notes text;

create index if not exists chat_rooms_approval_idx
  on public.chat_rooms (room_type, approval_status, created_at desc);

create or replace function public.create_thematic_chat(
  room_name text,
  room_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  new_room_id uuid;
begin
  if current_profile_id is null then
    raise exception 'É necessário entrar para criar uma conversa temática';
  end if;
  if not exists (
    select 1 from public.community_profiles
    where id = current_profile_id and onboarding_status = 'complete'
  ) then
    raise exception 'Complete seu perfil antes de criar uma conversa temática';
  end if;
  if length(trim(coalesce(room_name, ''))) < 3 then
    raise exception 'Informe um nome com pelo menos 3 caracteres';
  end if;
  if length(trim(room_name)) > 100 then
    raise exception 'O nome pode ter no máximo 100 caracteres';
  end if;
  if length(trim(coalesce(room_description, ''))) > 600 then
    raise exception 'A descrição pode ter no máximo 600 caracteres';
  end if;
  if (
    select count(*) from public.chat_rooms
    where owner_id = current_profile_id
      and room_type = 'group'
      and created_at > now() - interval '1 day'
  ) >= 3 then
    raise exception 'Você atingiu o limite diário de novas conversas temáticas';
  end if;

  insert into public.chat_rooms (
    owner_id, name, room_type, description, approval_status
  )
  values (
    current_profile_id, trim(room_name), 'group',
    nullif(trim(coalesce(room_description, '')), ''), 'pending'
  )
  returning id into new_room_id;

  insert into public.chat_room_members (room_id, profile_id, member_role)
  values (new_room_id, current_profile_id, 'owner');

  return new_room_id;
end;
$$;

revoke all on function public.create_thematic_chat(text, text) from public, anon;
grant execute on function public.create_thematic_chat(text, text) to authenticated;

create or replace function public.join_thematic_chat(target_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'É necessário entrar para participar';
  end if;
  if not exists (
    select 1 from public.chat_rooms
    where id = target_room_id
      and room_type = 'group'
      and approval_status = 'approved'
  ) then
    raise exception 'Conversa temática indisponível';
  end if;
  insert into public.chat_room_members (room_id, profile_id, member_role)
  values (target_room_id, current_profile_id, 'member')
  on conflict (room_id, profile_id) do nothing;
end;
$$;

revoke all on function public.join_thematic_chat(uuid) from public, anon;
grant execute on function public.join_thematic_chat(uuid) to authenticated;

drop policy if exists "Approved thematic rooms are discoverable" on public.chat_rooms;
create policy "Approved thematic rooms are discoverable"
on public.chat_rooms for select
using (
  (room_type = 'group' and approval_status = 'approved')
  or exists (
    select 1 from public.chat_room_members m
    where m.room_id = chat_rooms.id and m.profile_id = auth.uid()
  )
);

drop policy if exists "Room members see rooms" on public.chat_rooms;
