-- Área do membro: controle seguro do ciclo de vida dos próprios anúncios.

create or replace function public.manage_own_marketplace_listing(
  target_listing_id uuid,
  operation text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare current_status text;
begin
  select status into current_status
  from public.marketplace_listings
  where id = target_listing_id and owner_id = auth.uid()
  for update;

  if current_status is null then raise exception 'Anúncio não encontrado'; end if;

  if operation = 'pause' then
    if current_status <> 'published' then raise exception 'Apenas anúncios publicados podem ser pausados'; end if;
    update public.marketplace_listings
      set status = 'paused', moderation_notes = null, updated_at = now()
      where id = target_listing_id;
    return 'paused';
  elsif operation = 'submit' then
    if current_status not in ('draft','rejected','paused') then raise exception 'Este anúncio não pode ser reenviado agora'; end if;
    update public.marketplace_listings
      set status = 'pending', moderation_notes = null, updated_at = now()
      where id = target_listing_id;
    return 'pending';
  end if;

  raise exception 'Operação inválida';
end;
$$;

revoke all on function public.manage_own_marketplace_listing(uuid,text) from public, anon;
grant execute on function public.manage_own_marketplace_listing(uuid,text) to authenticated;

