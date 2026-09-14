-- Etapa 0: endurecimento de segurança da comunidade.
-- Corrige escaladas de privilégio em envios de eventos, posts e entrada em chats.

-- 1) Envios de eventos: membros podem criar/enviar para revisão, mas nunca
-- aprovar/publicar o próprio conteúdo alterando o campo status.
drop policy if exists "Members create own pending event submissions" on public.community_event_submissions;
create policy "Members create own reviewable event submissions"
on public.community_event_submissions
for insert to authenticated
with check (
  author_id = auth.uid()
  and status in ('draft','pending_review')
);

drop policy if exists "Members update draft submissions" on public.community_event_submissions;
drop policy if exists "Members update own reviewable submissions" on public.community_event_submissions;
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

-- 2) Perfil: uma pessoa verificada continua podendo editar o próprio perfil,
-- mas não pode conceder/remover o selo de verificação por conta própria.
drop policy if exists "Members update own profile" on public.community_profiles;
create policy "Members update own profile"
on public.community_profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create or replace function public.protect_community_profile_verification()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if private.has_role(auth.uid(), 'admin') or private.has_role(auth.uid(), 'revisor') then
    return new;
  end if;

  if auth.uid() is null or old.id <> auth.uid() then
    raise exception 'Acesso negado';
  end if;

  if new.verified is distinct from old.verified then
    raise exception 'A verificação do perfil só pode ser alterada pela moderação';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_community_profile_verification() from public, anon;
grant execute on function public.protect_community_profile_verification() to authenticated;

drop trigger if exists protect_community_profile_verification on public.community_profiles;
create trigger protect_community_profile_verification
before update on public.community_profiles
for each row execute function public.protect_community_profile_verification();

-- 3) Espaços e posts: áreas marcadas como "members" ficam restritas a usuários
-- autenticados e o espaço de comunicados/admin não aceita posts de membros comuns.
create policy "Authenticated members see member spaces"
on public.community_spaces
for select to authenticated
using (active and visibility = 'members');

drop policy if exists "Published posts are visible" on public.community_posts;
create policy "Published posts respect space visibility"
on public.community_posts
for select
using (
  status = 'published'
  and exists (
    select 1
    from public.community_spaces s
    where s.id = space_id
      and s.active
      and (
        s.visibility = 'public'
        or (s.visibility = 'members' and auth.uid() is not null)
      )
  )
);

drop policy if exists "Members create own posts" on public.community_posts;
create policy "Members create posts in member spaces"
on public.community_posts
for insert to authenticated
with check (
  author_id = auth.uid()
  and pinned = false
  and status = 'published'
  and exists (
    select 1
    from public.community_spaces s
    where s.id = space_id
      and s.active
      and s.posting_policy = 'members'
  )
);

drop policy if exists "Authors manage own posts" on public.community_posts;
create policy "Authors update own posts in member spaces"
on public.community_posts
for update to authenticated
using (author_id = auth.uid())
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.community_spaces s
    where s.id = space_id
      and s.active
      and s.posting_policy = 'members'
  )
);

create or replace function public.protect_community_post_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if private.has_role(auth.uid(), 'admin') or private.has_role(auth.uid(), 'revisor') then
    return new;
  end if;

  if auth.uid() is null or old.author_id <> auth.uid() then
    raise exception 'Acesso negado';
  end if;

  if new.pinned is distinct from old.pinned then
    raise exception 'Somente a moderação pode fixar publicações';
  end if;

  if new.author_id is distinct from old.author_id then
    raise exception 'O autor da publicação não pode ser alterado';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_community_post_privileged_fields() from public, anon;
grant execute on function public.protect_community_post_privileged_fields() to authenticated;

drop trigger if exists protect_community_post_privileged_fields on public.community_posts;
create trigger protect_community_post_privileged_fields
before update on public.community_posts
for each row execute function public.protect_community_post_privileged_fields();

-- 4) Entrar em uma sala passa a depender do proprietário da sala.
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

-- 5) Evita que a função auxiliar de membership seja usada para enumerar
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

-- 6) A política dizia "soft delete", mas RLS por si só permitia ao remetente
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
drop policy if exists "Senders soft delete own messages" on public.chat_messages;
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
