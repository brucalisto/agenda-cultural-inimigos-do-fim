-- Transactional moderation: approved community events become official agenda entries.
create or replace function public.publish_community_event(submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.community_event_submissions;
  target_id uuid;
begin
  if not (private.has_role(auth.uid(), 'admin') or private.has_role(auth.uid(), 'revisor')) then
    raise exception 'Acesso negado';
  end if;

  select * into source
  from public.community_event_submissions
  where id = submission_id
  for update;

  if source.id is null then raise exception 'Envio não encontrado'; end if;
  if source.status = 'published' and source.published_event_id is not null then
    return source.published_event_id;
  end if;
  if source.title is null or source.event_date is null or source.city is null then
    raise exception 'Título, data e cidade são obrigatórios';
  end if;

  select id into target_id
  from public.interpreted_contents
  where lower(trim(title)) = lower(trim(source.title))
    and event_date::date = source.event_date
    and lower(coalesce(city,'')) = lower(coalesce(source.city,''))
    and review_status = 'publicado'
  limit 1;

  if target_id is not null then
    update public.community_event_submissions
    set duplicate_of = target_id, status = 'changes_requested',
        moderation_notes = 'Possível duplicidade: já existe um evento com mesmo título, data e cidade.',
        updated_at = now()
    where id = submission_id;
    raise exception 'Possível evento duplicado';
  end if;

  insert into public.interpreted_contents (
    title, category, summary, full_description, event_date, location, city,
    price, contact_name, contact_phone, source_url, image_url, keywords,
    extracted_data, confidence_score, model_used, prompt_version,
    review_status, reviewed_by, reviewed_at
  ) values (
    source.title, source.category, left(coalesce(source.description, source.source_text, ''), 280),
    coalesce(source.description, source.source_text),
    (source.event_date::text || ' ' || coalesce(source.start_time::text, '00:00:00'))::timestamptz,
    concat_ws(' — ', nullif(source.venue_name,''), nullif(source.address,'')),
    source.city, source.price_info, null, source.contact_info, source.ticket_url,
    source.cover_url, array['comunidade'], jsonb_build_object('community_submission_id', source.id, 'submitted_by', source.author_id),
    1, 'community-reviewed', 'community-v1', 'publicado', auth.uid(), now()
  ) returning id into target_id;

  update public.community_event_submissions
  set status = 'published', published_event_id = target_id,
      moderation_notes = 'Aprovado e publicado na agenda.', updated_at = now()
  where id = submission_id;

  return target_id;
end;
$$;

revoke all on function public.publish_community_event(uuid) from public, anon;
grant execute on function public.publish_community_event(uuid) to authenticated;

create or replace function public.moderate_marketplace_listing(listing_id uuid, decision text, notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (private.has_role(auth.uid(), 'admin') or private.has_role(auth.uid(), 'revisor')) then
    raise exception 'Acesso negado';
  end if;
  if decision not in ('published','rejected','paused') then raise exception 'Decisão inválida'; end if;
  update public.marketplace_listings set status = decision, moderation_notes = notes, updated_at = now() where id = listing_id;
  if not found then raise exception 'Anúncio não encontrado'; end if;
end;
$$;

revoke all on function public.moderate_marketplace_listing(uuid,text,text) from public, anon;
grant execute on function public.moderate_marketplace_listing(uuid,text,text) to authenticated;
