-- Community, cultural portfolio, collaborative event submissions and marketplace foundation

create table if not exists public.community_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  artistic_name text,
  profile_type text not null default 'publico' check (profile_type in ('artista','produtor','espaco','coletivo','artesao','servico','publico')),
  short_bio text,
  full_bio text,
  city text,
  neighborhood text,
  avatar_url text,
  cover_url text,
  categories text[] not null default '{}',
  skills text[] not null default '{}',
  collaboration_interests text[] not null default '{}',
  contact_email text,
  contact_phone text,
  instagram text,
  website text,
  visibility text not null default 'public' check (visibility in ('public','members','private')),
  onboarding_status text not null default 'started' check (onboarding_status in ('started','draft','complete')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.community_profiles(id) on delete cascade,
  media_type text not null check (media_type in ('image','video','audio','document','link')),
  title text,
  description text,
  media_url text not null,
  thumbnail_url text,
  alt_text text,
  sort_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.community_profiles(id) on delete cascade,
  listing_type text not null check (listing_type in ('product','service','class','experience')),
  title text not null,
  description text,
  category text,
  price_amount numeric(12,2),
  price_label text,
  city text,
  contact_url text,
  cover_url text,
  gallery_urls text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','pending','published','rejected','paused')),
  moderation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_tools (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  short_description text,
  description text,
  cover_url text,
  sales_url text,
  price_label text,
  benefits text[] not null default '{}',
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','paused')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  visibility text not null default 'public' check (visibility in ('public','members')),
  posting_policy text not null default 'members' check (posting_policy in ('admin','members')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.community_spaces(id) on delete cascade,
  author_id uuid not null references public.community_profiles(id) on delete cascade,
  title text,
  body text not null,
  media_urls text[] not null default '{}',
  status text not null default 'published' check (status in ('published','hidden','removed')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.community_profiles(id) on delete cascade,
  name text,
  room_type text not null default 'direct' check (room_type in ('direct','group','project')),
  description text,
  related_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  profile_id uuid not null references public.community_profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','moderator','member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, profile_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.community_profiles(id) on delete cascade,
  body text,
  media_urls text[] not null default '{}',
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.community_event_submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.community_profiles(id) on delete cascade,
  input_type text not null check (input_type in ('image','text','link','audio','manual','mixed')),
  source_text text,
  source_urls text[] not null default '{}',
  title text,
  description text,
  event_date date,
  start_time time,
  end_time time,
  venue_name text,
  address text,
  city text,
  price_info text,
  category text,
  contact_info text,
  ticket_url text,
  cover_url text,
  ai_extracted_data jsonb not null default '{}'::jsonb,
  duplicate_of uuid,
  status text not null default 'draft' check (status in ('draft','processing','needs_information','pending_review','approved','changes_requested','rejected','published')),
  moderation_notes text,
  published_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_profiles enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.platform_tools enable row level security;
alter table public.community_spaces enable row level security;
alter table public.community_posts enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.community_event_submissions enable row level security;

create policy "Public profiles are discoverable" on public.community_profiles for select using (visibility = 'public' or id = auth.uid());
create policy "Members manage own profile" on public.community_profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "Public portfolio is visible" on public.portfolio_items for select using (is_public or profile_id = auth.uid());
create policy "Members manage own portfolio" on public.portfolio_items for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "Published listings are public" on public.marketplace_listings for select using (status = 'published' or owner_id = auth.uid());
create policy "Members manage own listings" on public.marketplace_listings for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Published tools are public" on public.platform_tools for select using (status = 'published');
create policy "Active public spaces are visible" on public.community_spaces for select using (active and visibility = 'public');
create policy "Published posts are visible" on public.community_posts for select using (status = 'published');
create policy "Members create own posts" on public.community_posts for insert to authenticated with check (author_id = auth.uid());
create policy "Authors manage own posts" on public.community_posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "Room members see rooms" on public.chat_rooms for select to authenticated using (
  exists (select 1 from public.chat_room_members m where m.room_id = id and m.profile_id = auth.uid())
);
create policy "Members create rooms" on public.chat_rooms for insert to authenticated with check (owner_id = auth.uid());
create policy "Room owners update rooms" on public.chat_rooms for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Room members see membership" on public.chat_room_members for select to authenticated using (
  exists (select 1 from public.chat_room_members mine where mine.room_id = room_id and mine.profile_id = auth.uid())
);
create policy "Room owners manage membership" on public.chat_room_members for insert to authenticated with check (
  exists (select 1 from public.chat_rooms r where r.id = room_id and r.owner_id = auth.uid())
  or profile_id = auth.uid()
);

create policy "Room members read messages" on public.chat_messages for select to authenticated using (
  exists (select 1 from public.chat_room_members m where m.room_id = chat_messages.room_id and m.profile_id = auth.uid())
);
create policy "Room members send messages" on public.chat_messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (select 1 from public.chat_room_members m where m.room_id = chat_messages.room_id and m.profile_id = auth.uid())
);
create policy "Senders soft delete messages" on public.chat_messages for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

create policy "Members see own event submissions" on public.community_event_submissions for select to authenticated using (author_id = auth.uid());
create policy "Members create own event submissions" on public.community_event_submissions for insert to authenticated with check (author_id = auth.uid());
create policy "Members update draft submissions" on public.community_event_submissions for update to authenticated using (author_id = auth.uid() and status in ('draft','needs_information','changes_requested')) with check (author_id = auth.uid());

create or replace function public.create_community_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.community_profiles (id, display_name, contact_email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_community_profile on auth.users;
create trigger on_auth_user_created_community_profile
after insert on auth.users
for each row execute procedure public.create_community_profile();

insert into public.community_spaces (name, slug, description, icon, posting_policy)
values
  ('Comunicados', 'comunicados', 'Novidades oficiais do Inimigos do Fim.', 'megaphone', 'admin'),
  ('Geral', 'geral', 'Apresentações, ideias e encontros da comunidade.', 'messages', 'members'),
  ('Música e cena', 'musica-e-cena', 'Música, teatro, dança e apresentações.', 'radio', 'members'),
  ('Artes visuais', 'artes-visuais', 'Design, fotografia, audiovisual e exposições.', 'palette', 'members'),
  ('Parcerias e oportunidades', 'parcerias-e-oportunidades', 'Editais, equipes, serviços e colaborações.', 'handshake', 'members')
on conflict (slug) do nothing;

create index if not exists community_profiles_discovery_idx on public.community_profiles (city, profile_type, visibility);
create index if not exists marketplace_listings_status_idx on public.marketplace_listings (status, category, created_at desc);
create index if not exists community_posts_space_idx on public.community_posts (space_id, created_at desc);
create index if not exists chat_messages_room_idx on public.chat_messages (room_id, created_at desc);
create index if not exists community_event_submissions_status_idx on public.community_event_submissions (status, created_at desc);
