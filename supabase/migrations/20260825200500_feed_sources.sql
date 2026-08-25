create table if not exists public.feed_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  source_type text not null default 'web',
  active boolean not null default true,
  trusted boolean not null default false,
  auto_publish boolean not null default false,
  last_synced_at timestamp with time zone,
  last_sync_status text,
  last_sync_result jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

comment on table public.feed_sources is 'Fontes externas usadas para alimentar a Agenda Cultural.';

grant all on public.feed_sources to service_role;

alter table public.feed_sources enable row level security;

insert into public.feed_sources (name, url, source_type, active, trusted, auto_publish)
values (
  'Agenda Cultural Inimigos do Fim — Notion',
  'https://tide-candy-1f5.notion.site/68ee129b62a5465197a1f0d7b47afcda?v=94c86de6ba024fac98c266b5c68bcbb8&source=copy_link',
  'notion',
  true,
  true,
  true
)
on conflict (url) do update set
  name = excluded.name,
  source_type = excluded.source_type,
  active = true,
  trusted = true,
  auto_publish = true,
  updated_at = now();
