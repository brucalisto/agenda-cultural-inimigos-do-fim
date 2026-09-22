-- Anexos privados, gestão segura de participantes e controle de mensagens não lidas.

create table if not exists public.chat_read_receipts (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  profile_id uuid not null references public.community_profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (room_id, profile_id)
);

alter table public.chat_read_receipts enable row level security;

drop policy if exists "Members read own chat receipts" on public.chat_read_receipts;
create policy "Members read own chat receipts"
on public.chat_read_receipts for select to authenticated
using (profile_id = auth.uid() and public.is_chat_room_member(room_id));

create index if not exists chat_read_receipts_profile_idx
  on public.chat_read_receipts (profile_id, last_read_at);

create or replace function public.mark_chat_read(
  target_room_id uuid,
  read_through timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null or not public.is_chat_room_member(target_room_id) then
    raise exception 'Acesso negado';
  end if;

  insert into public.chat_read_receipts (room_id, profile_id, last_read_at)
  values (target_room_id, auth.uid(), coalesce(read_through, now()))
  on conflict (room_id, profile_id) do update
  set last_read_at = greatest(chat_read_receipts.last_read_at, excluded.last_read_at);
end;
$$;

revoke all on function public.mark_chat_read(uuid, timestamptz) from public, anon;
grant execute on function public.mark_chat_read(uuid, timestamptz) to authenticated;

create or replace function public.get_chat_unread_counts()
returns table (chat_room_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    membership.room_id as chat_room_id,
    count(message.id) filter (
      where message.sender_id <> auth.uid()
        and message.deleted_at is null
        and message.created_at > coalesce(receipt.last_read_at, membership.joined_at)
    ) as unread_count
  from public.chat_room_members as membership
  left join public.chat_read_receipts as receipt
    on receipt.room_id = membership.room_id
   and receipt.profile_id = membership.profile_id
  left join public.chat_messages as message
    on message.room_id = membership.room_id
  where membership.profile_id = auth.uid()
  group by membership.room_id;
$$;

revoke all on function public.get_chat_unread_counts() from public, anon;
grant execute on function public.get_chat_unread_counts() to authenticated;

create or replace function public.manage_chat_member(
  target_room_id uuid,
  target_profile_id uuid,
  operation text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  room_owner_id uuid;
begin
  select owner_id into room_owner_id
  from public.chat_rooms
  where id = target_room_id;

  if room_owner_id is null or room_owner_id <> auth.uid() then
    raise exception 'Somente a pessoa responsável pode gerenciar participantes';
  end if;

  if operation = 'add' then
    if not exists (
      select 1 from public.community_profiles
      where id = target_profile_id and visibility = 'public'
    ) then
      raise exception 'Perfil indisponível';
    end if;

    insert into public.chat_room_members (room_id, profile_id, member_role)
    values (target_room_id, target_profile_id, 'member')
    on conflict (room_id, profile_id) do nothing;
  elsif operation = 'remove' then
    if target_profile_id = room_owner_id then
      raise exception 'A pessoa responsável não pode ser removida da própria conversa';
    end if;

    delete from public.chat_room_members
    where room_id = target_room_id
      and profile_id = target_profile_id;
  else
    raise exception 'Operação inválida';
  end if;
end;
$$;

revoke all on function public.manage_chat_member(uuid, uuid, text) from public, anon;
grant execute on function public.manage_chat_member(uuid, uuid, text) to authenticated;

create or replace function public.protect_chat_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  room_owner_id uuid;
begin
  select owner_id into room_owner_id
  from public.chat_rooms
  where id = old.room_id;

  if old.profile_id = room_owner_id or old.member_role = 'owner' then
    if not private.has_role(auth.uid(), 'admin') then
      raise exception 'A participação da pessoa responsável não pode ser alterada';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.member_role = 'owner'
     and new.profile_id <> room_owner_id
     and not private.has_role(auth.uid(), 'admin') then
    raise exception 'A sala já possui uma pessoa responsável';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_chat_owner_membership on public.chat_room_members;
create trigger protect_chat_owner_membership
before update or delete on public.chat_room_members
for each row execute function public.protect_chat_owner_membership();

create or replace function public.can_read_chat_attachment(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  folders text[];
  target_room_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  folders := storage.foldername(object_name);
  if coalesce(array_length(folders, 1), 0) < 3
     or folders[2] <> 'chat'
     or folders[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  target_room_id := folders[3]::uuid;
  return public.is_chat_room_member(target_room_id);
end;
$$;

revoke all on function public.can_read_chat_attachment(text) from public, anon;
grant execute on function public.can_read_chat_attachment(text) to authenticated;

drop policy if exists "Community members read own private files" on storage.objects;
create policy "Community members read permitted private files"
on storage.objects
for select to authenticated
using (
  bucket_id = 'community-private-files'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.can_read_chat_attachment(name)
    or private.has_role(auth.uid(), 'admin')
    or private.has_role(auth.uid(), 'revisor')
  )
);

