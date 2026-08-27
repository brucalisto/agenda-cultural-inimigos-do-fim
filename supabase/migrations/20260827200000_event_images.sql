alter table public.interpreted_contents
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 8388608, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true;

create index if not exists interpreted_contents_published_featured_date_idx
  on public.interpreted_contents (is_featured, featured_priority desc, event_date)
  where review_status = 'publicado';
