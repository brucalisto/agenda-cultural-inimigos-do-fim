-- Regras de integridade para os anúncios enriquecidos do marketplace.

create or replace function public.validate_marketplace_listing_content()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if array_length(new.gallery_urls, 1) > 6 then
    raise exception 'O anúncio pode ter no máximo 6 imagens';
  end if;
  new.contact_url := nullif(trim(new.contact_url), '');
  if new.contact_url is not null then
    if new.contact_url ~ '^@[A-Za-z0-9._]+$' then
      new.contact_url := 'https://instagram.com/' || substring(new.contact_url from 2);
    elsif regexp_replace(new.contact_url, '[^0-9]', '', 'g') ~ '^[0-9]{10,15}$' then
      new.contact_url := 'https://wa.me/' ||
        case
          when regexp_replace(new.contact_url, '[^0-9]', '', 'g') like '55%'
            then regexp_replace(new.contact_url, '[^0-9]', '', 'g')
          else '55' || regexp_replace(new.contact_url, '[^0-9]', '', 'g')
        end;
    elsif new.contact_url ~* '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/.*)?$' then
      new.contact_url := 'https://' || new.contact_url;
    elsif new.contact_url !~* '^(https?://|mailto:|tel:)' then
      raise exception 'O contato precisa usar um endereço seguro';
    end if;
  end if;
  if char_length(new.title) > 120 then
    raise exception 'O título pode ter no máximo 120 caracteres';
  end if;
  if new.description is not null and char_length(new.description) > 5000 then
    raise exception 'A descrição pode ter no máximo 5000 caracteres';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_marketplace_listing_content() from public, anon;
grant execute on function public.validate_marketplace_listing_content() to authenticated;

drop trigger if exists validate_marketplace_listing_content on public.marketplace_listings;
create trigger validate_marketplace_listing_content
before insert or update on public.marketplace_listings
for each row execute function public.validate_marketplace_listing_content();

create index if not exists marketplace_listings_public_filters_idx
  on public.marketplace_listings (status, listing_type, category, city, created_at desc);
