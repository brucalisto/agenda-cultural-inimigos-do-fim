-- Etapa 0: endurecimento de segurança da comunidade.
-- Corrige escaladas de privilégio em envios de eventos e entrada em chats.

-- 1) Um membro não pode transformar um envio próprio em aprovado/publicado.
drop policy if exists "Members update draft submissions" on public.community_event_submissions;
create policy "Members update own reviewable submissions"
on public.community_event_submissions
for update to authenticated
using (
  author_id = auth.uid()
  and status in ('draft','needs_information','changes_requested','pending_review')
)
with check (
  author_id = auth.uid()
  and status in ('draft','needs_information','changes_requested','pending_review')
);

-- 2) Entrar em uma sala passa a depender do proprietário da sala.
-- A política antiga também permitia `profile_id = auth.uid()`, o que possibilitava
-- que qualquer usuário adicionasse a si próprio a uma sala privada cujo UUID conhecesse.
drop policy if exists "Room owners manage membership" on public.chat_room_members;

create policy "Room owners add members"
on public.chat_room_members
for insert to authenticated
with check (
  exists (
    select 1
    from public.chat_rooms r
    where r.id = room_id
      and r.owner_id = auth.uid()
  )
);

create policy "Room owners update membership"
on public.chat_room_members
for update to authenticated
using (
  exists (
    select 1
    from public.chat_rooms r
    where r.id = room_id
      and r.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_rooms r
    where r.id = room_id
      and r.owner_id = auth.uid()
  )
);

create policy "Owners remove members or members leave"
on public.chat_room_members
for delete to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.chat_rooms r
    where r.id = room_id
      and r.owner_id = auth.uid()
  )
);

-- 3) Evita que a função auxiliar de membership seja usada para enumerar
-- a participação de terceiros em salas privadas.
create or replace function public.is_chat_room_member(
  target_room_id uuid,
  target_profile_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select case
    when auth.uid() is null then false
    when target_profile_id = auth.uid()
      or private.has_role(auth.uid(), 'admin')
      or private.has_role(auth.uid(), 'revisor')
    then exists (
      select 1
      from public.chat_room_members
      where room_id = target_room_id
        and profile_id = target_profile_id
    )
    else false
  end;
$$;

revoke all on function public.is_chat_room_member(uuid, uuid) from public, anon;
grant execute on function public.is_chat_room_member(uuid, uuid) to authenticated;

-- 4) A política dizia "soft delete", mas RLS por si só permitia ao remetente
-- alterar também corpo, sala, mídia e resposta. O trigger torna esses campos
-- imutáveis para membros comuns e permite somente marcar deleted_at.
create or replace function public.enforce_chat_message_member_update()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if private.has_role(auth.uid(), 'admin') or private.has_role(auth.uid(), 'revisor') then
    return new;
  end if;

  if auth.uid() is null or old.sender_id <> auth.uid() then
    raise exception 'Acesso negado';
  end if;

  if new.sender_id is distinct from old.sender_id
     or new.room_id is distinct from old.room_id
     or new.body is distinct from old.body
     or new.media_urls is distinct from old.media_urls
     or new.reply_to_id is distinct from old.reply_to_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Mensagens publicadas são imutáveis; somente a exclusão suave é permitida';
  end if;

  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'Mensagem já removida';
  end if;

  if new.deleted_at is null then
    raise exception 'Somente a exclusão suave é permitida';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_chat_message_member_update() from public, anon;
grant execute on function public.enforce_chat_message_member_update() to authenticated;

drop trigger if exists enforce_chat_message_member_update on public.chat_messages;
create trigger enforce_chat_message_member_update
before update on public.chat_messages
for each row execute function public.enforce_chat_message_member_update();

drop policy if exists "Senders soft delete messages" on public.chat_messages;
create policy "Senders soft delete own messages"
on public.chat_messages
for update to authenticated
using (
  sender_id = auth.uid()
  and public.is_chat_room_member(room_id)
)
with check (
  sender_id = auth.uid()
  and public.is_chat_room_member(room_id)
);
