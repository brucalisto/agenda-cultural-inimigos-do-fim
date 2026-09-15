begin;

-- Contatos diretos de perfil deixam de morar na linha pública/discoverable.
-- Os campos legados permanecem na tabela principal por compatibilidade de schema,
-- mas passam a aceitar apenas NULL para impedir vazamento acidental por SELECT *.
create table if not exists public.community_profile_private (
  profile_id uuid primary key references public.community_profiles(id) on delete cascade,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_profile_private enable row level security;

-- Preserva qualquer contato já cadastrado antes de limpar a linha pública.
insert into public.community_profile_private (
  profile_id,
  contact_email,
  contact_phone,
  created_at,
  updated_at
)
select
  id,
  nullif(btrim(contact_email), ''),
  nullif(btrim(contact_phone), ''),
  created_at,
  now()
from public.community_profiles
where nullif(btrim(contact_email), '') is not null
   or nullif(btrim(contact_phone), '') is not null
on conflict (profile_id) do update
set contact_email = coalesce(excluded.contact_email, community_profile_private.contact_email),
    contact_phone = coalesce(excluded.contact_phone, community_profile_private.contact_phone),
    updated_at = now();

update public.community_profiles
set contact_email = null,
    contact_phone = null,
    updated_at = now()
where contact_email is not null
   or contact_phone is not null;

alter table public.community_profiles
  drop constraint if exists community_profiles_private_contacts_are_null;

alter table public.community_profiles
  add constraint community_profiles_private_contacts_are_null
  check (contact_email is null and contact_phone is null);

-- Somente a própria pessoa e a moderação acessam os contatos privados.
drop policy if exists "Members read own private profile" on public.community_profile_private;
create policy "Members read own private profile"
on public.community_profile_private
for select to authenticated
using (profile_id = auth.uid());

drop policy if exists "Members insert own private profile" on public.community_profile_private;
create policy "Members insert own private profile"
on public.community_profile_private
for insert to authenticated
with check (profile_id = auth.uid());

drop policy if exists "Members update own private profile" on public.community_profile_private;
create policy "Members update own private profile"
on public.community_profile_private
for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "Members delete own private profile" on public.community_profile_private;
create policy "Members delete own private profile"
on public.community_profile_private
for delete to authenticated
using (profile_id = auth.uid());

drop policy if exists "Moderators manage private profiles" on public.community_profile_private;
create policy "Moderators manage private profiles"
on public.community_profile_private
for all to authenticated
using (private.has_role(auth.uid(), 'admin') or private.has_role(auth.uid(), 'revisor'))
with check (private.has_role(auth.uid(), 'admin') or private.has_role(auth.uid(), 'revisor'));

-- Novos cadastros criam o perfil público sem e-mail/telefone e salvam o e-mail
-- de autenticação somente na área privada.
create or replace function public.create_community_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.community_profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.community_profile_private (profile_id, contact_email)
  values (new.id, new.email)
  on conflict (profile_id) do update
  set contact_email = coalesce(community_profile_private.contact_email, excluded.contact_email),
      updated_at = now();

  return new;
end;
$$;

commit;
