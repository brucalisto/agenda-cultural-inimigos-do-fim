alter table public.interpreted_contents
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create index if not exists interpreted_contents_coordinates_idx
  on public.interpreted_contents (latitude, longitude)
  where latitude is not null and longitude is not null;
