-- Completa o perfil cultural com preferências explícitas de contato.
-- Contatos continuam privados por padrão e só são exibidos quando a pessoa opta por publicá-los.

alter table public.community_profiles
  add column if not exists public_email boolean not null default false,
  add column if not exists public_phone boolean not null default false,
  add column if not exists allow_direct_messages boolean not null default true;

comment on column public.community_profiles.public_email is
  'Permite exibir contact_email no perfil público quando true.';
comment on column public.community_profiles.public_phone is
  'Permite exibir contact_phone no perfil público quando true.';
comment on column public.community_profiles.allow_direct_messages is
  'Permite que outros perfis públicos iniciem conversa direta.';

create or replace function public.start_direct_chat(target_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_profile_id uuid := auth.uid();
  direct_room_id uuid;
  pair_key text;
begin
  if current_profile_id is null then
    raise exception 'É necessário entrar para iniciar uma conversa';
  end if;

  if target_profile_id is null then
    raise exception 'Perfil de destino inválido';
  end if;

  if current_profile_id = target_profile_id then
    raise exception 'Você não pode iniciar uma conversa consigo';
  end if;

  if not exists (
    select 1 from public.community_profiles where id = current_profile_id
  ) then
    raise exception 'Crie seu perfil antes de iniciar uma conversa';
  end if;

  if not exists (
    select 1
    from public.community_profiles
    where id = target_profile_id
      and visibility = 'public'
      and allow_direct_messages = true
  ) then
    raise exception 'Este perfil não está recebendo novas conversas';
  end if;

  pair_key := least(current_profile_id::text, target_profile_id::text)
    || ':' || greatest(current_profile_id::text, target_profile_id::text);
  perform pg_advisory_xact_lock(hashtextextended(pair_key, 0));

  select room.id into direct_room_id
  from public.chat_rooms as room
  where room.room_type = 'direct'
    and (select count(*) from public.chat_room_members m where m.room_id = room.id) = 2
    and exists (select 1 from public.chat_room_members m where m.room_id = room.id and m.profile_id = current_profile_id)
    and exists (select 1 from public.chat_room_members m where m.room_id = room.id and m.profile_id = target_profile_id)
  order by room.created_at asc
  limit 1;

  if direct_room_id is not null then
    return direct_room_id;
  end if;

  insert into public.chat_rooms (owner_id, name, room_type, description)
  values (current_profile_id, 'Conversa privada', 'direct', null)
  returning id into direct_room_id;

  insert into public.chat_room_members (room_id, profile_id, member_role)
  values
    (direct_room_id, current_profile_id, 'owner'),
    (direct_room_id, target_profile_id, 'member');

  return direct_room_id;
end;
$$;

revoke all on function public.start_direct_chat(uuid) from public, anon;
grant execute on function public.start_direct_chat(uuid) to authenticated;
