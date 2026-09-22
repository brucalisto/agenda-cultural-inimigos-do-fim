-- Ativa os espaços iniciais da comunidade e cria salas privadas de forma atômica.

insert into public.community_spaces (name, slug, description, icon, visibility, posting_policy, active)
values
  ('Comunicados', 'comunicados', 'Novidades oficiais do Inimigos do Fim.', 'bell', 'public', 'admin', true),
  ('Geral', 'geral', 'Apresentações, ideias e encontros da comunidade.', 'message-circle', 'public', 'members', true),
  ('Música e cena', 'musica-e-cena', 'Shows, bandas, DJs, teatro e dança.', 'radio', 'public', 'members', true),
  ('Artes visuais', 'artes-visuais', 'Design, fotografia, audiovisual e exposições.', 'palette', 'public', 'members', true),
  ('Parcerias e oportunidades', 'parcerias-e-oportunidades', 'Editais, equipes, serviços e colaborações.', 'handshake', 'public', 'members', true)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  visibility = excluded.visibility,
  posting_policy = excluded.posting_policy,
  active = true;

create index if not exists community_posts_space_created_idx
  on public.community_posts (space_id, created_at desc)
  where status = 'published';

create index if not exists chat_messages_room_created_idx
  on public.chat_messages (room_id, created_at);

-- Realtime é necessário para que novas publicações e mensagens apareçam sem recarregar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_posts'
  ) then
    alter publication supabase_realtime add table public.community_posts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;

create or replace function public.create_private_chat(
  room_name text,
  room_description text default null,
  invited_profile_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_profile_id uuid := auth.uid();
  new_room_id uuid;
begin
  if current_profile_id is null then
    raise exception 'É necessário entrar para criar uma conversa';
  end if;

  if not exists (select 1 from public.community_profiles where id = current_profile_id) then
    raise exception 'Crie seu perfil antes de iniciar uma conversa';
  end if;

  if length(trim(coalesce(room_name, ''))) < 2 then
    raise exception 'Informe um nome para a conversa';
  end if;

  insert into public.chat_rooms (owner_id, name, room_type, description)
  values (current_profile_id, trim(room_name), 'project', nullif(trim(coalesce(room_description, '')), ''))
  returning id into new_room_id;

  insert into public.chat_room_members (room_id, profile_id, member_role)
  values (new_room_id, current_profile_id, 'owner');

  insert into public.chat_room_members (room_id, profile_id, member_role)
  select new_room_id, profile.id, 'member'
  from public.community_profiles as profile
  where profile.id = any(coalesce(invited_profile_ids, '{}'::uuid[]))
    and profile.id <> current_profile_id
    and profile.visibility = 'public'
  on conflict (room_id, profile_id) do nothing;

  return new_room_id;
end;
$$;

revoke all on function public.create_private_chat(text, text, uuid[]) from public, anon;
grant execute on function public.create_private_chat(text, text, uuid[]) to authenticated;
