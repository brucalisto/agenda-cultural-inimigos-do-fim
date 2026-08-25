alter table public.interpreted_contents
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_priority integer not null default 0,
  add column if not exists featured_starts_at timestamptz,
  add column if not exists featured_ends_at timestamptz,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geocoded_at timestamptz;

alter table public.interpreted_contents
  add constraint interpreted_contents_latitude_check
    check (latitude is null or latitude between -90 and 90),
  add constraint interpreted_contents_longitude_check
    check (longitude is null or longitude between -180 and 180);

create index if not exists interpreted_contents_public_agenda_idx
  on public.interpreted_contents (review_status, event_date);

create index if not exists interpreted_contents_featured_idx
  on public.interpreted_contents (is_featured, featured_priority desc)
  where review_status = 'publicado';
