-- Favoritos privados do marketplace para membros autenticados.
create table if not exists public.marketplace_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

alter table public.marketplace_favorites enable row level security;

drop policy if exists "Members view own marketplace favorites" on public.marketplace_favorites;
create policy "Members view own marketplace favorites"
  on public.marketplace_favorites for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Members create own marketplace favorites" on public.marketplace_favorites;
create policy "Members create own marketplace favorites"
  on public.marketplace_favorites for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.marketplace_listings listing
      where listing.id = listing_id and listing.status = 'published'
    )
  );

drop policy if exists "Members remove own marketplace favorites" on public.marketplace_favorites;
create policy "Members remove own marketplace favorites"
  on public.marketplace_favorites for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.marketplace_favorites to authenticated;
grant all on public.marketplace_favorites to service_role;

create index if not exists marketplace_favorites_user_created_idx
  on public.marketplace_favorites (user_id, created_at desc);
