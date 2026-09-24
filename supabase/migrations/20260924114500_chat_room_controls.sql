-- Etapa 6: controles seguros das conversas privadas e temáticas.

create or replace function public.leave_chat_room(target_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  room_owner uuid;
  room_kind text;
  successor uuid;
begin
  if current_profile_id is null then raise exception 'É necessário entrar'; end if;

  select owner_id, room_type into room_owner, room_kind
  from public.chat_rooms where id = target_room_id;
  if room_owner is null then raise exception 'Conversa não encontrada'; end if;
  if not exists (select 1 from public.chat_room_members where room_id=target_room_id and profile_id=current_profile_id) then
    raise exception 'Você não participa desta conversa';
  end if;

  if room_owner = current_profile_id then
    select profile_id into successor
    from public.chat_room_members
    where room_id=target_room_id and profile_id<>current_profile_id
    order by joined_at asc limit 1;
    if successor is not null then
      update public.chat_rooms set owner_id=successor, updated_at=now() where id=target_room_id;
      update public.chat_room_members set member_role='owner' where room_id=target_room_id and profile_id=successor;
    end if;
  end if;

  delete from public.chat_room_members where room_id=target_room_id and profile_id=current_profile_id;
  if not exists (select 1 from public.chat_room_members where room_id=target_room_id) then
    delete from public.chat_rooms where id=target_room_id;
  end if;
end;
$$;

create or replace function public.update_chat_room(target_room_id uuid, new_name text, new_description text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'É necessário entrar'; end if;
  if not exists (select 1 from public.chat_rooms where id=target_room_id and owner_id=auth.uid()) then
    raise exception 'Somente a pessoa responsável pode editar esta conversa';
  end if;
  if length(trim(coalesce(new_name,''))) < 2 or length(trim(new_name)) > 100 then
    raise exception 'O nome deve ter entre 2 e 100 caracteres';
  end if;
  if length(trim(coalesce(new_description,''))) > 600 then raise exception 'Descrição muito longa'; end if;
  update public.chat_rooms set name=trim(new_name), description=nullif(trim(coalesce(new_description,'')),''), updated_at=now()
  where id=target_room_id;
end;
$$;

revoke all on function public.leave_chat_room(uuid) from public, anon;
revoke all on function public.update_chat_room(uuid,text,text) from public, anon;
grant execute on function public.leave_chat_room(uuid) to authenticated;
grant execute on function public.update_chat_room(uuid,text,text) to authenticated;
