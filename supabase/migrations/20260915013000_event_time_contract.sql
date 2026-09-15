-- Contrato canônico para distinguir "data conhecida" de "horário informado".
--
-- `interpreted_contents.event_date` continua sendo timestamptz para preservar o
-- instante quando há horário. Quando a fonte informa somente a data, gravamos o
-- dia civil às 00:00 de America/Sao_Paulo e marcamos `time_was_informed = false`.
-- A interface pode então exibir a data correta sem inventar "00:00" para o público.

alter table public.interpreted_contents
  add column if not exists time_was_informed boolean;

comment on column public.interpreted_contents.time_was_informed is
  'true quando a fonte informou horário explicitamente; false quando somente a data é conhecida; null para registros legados sem evidência suficiente';

-- Recupera o sinal já existente em envios da comunidade e outros registros que
-- o preservaram dentro de extracted_data. Registros antigos ambíguos permanecem
-- null de propósito: não inferimos que meia-noite significa "sem horário".
update public.interpreted_contents
set time_was_informed = (extracted_data->>'time_was_informed')::boolean
where time_was_informed is null
  and jsonb_typeof(extracted_data->'time_was_informed') = 'boolean';

update public.interpreted_contents
set time_was_informed = false
where time_was_informed is null
  and event_date is null;

-- Mantém coluna e metadado técnico sincronizados para que APIs antigas que já
-- carregam extracted_data também consigam consumir o novo contrato sem quebra.
create or replace function public.sync_event_time_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.extracted_data := coalesce(new.extracted_data, '{}'::jsonb);

  if new.time_was_informed is null
     and jsonb_typeof(new.extracted_data->'time_was_informed') = 'boolean' then
    new.time_was_informed := (new.extracted_data->>'time_was_informed')::boolean;
  end if;

  if new.event_date is null and new.time_was_informed is null then
    new.time_was_informed := false;
  end if;

  if new.time_was_informed is not null then
    new.extracted_data := new.extracted_data
      || jsonb_build_object('time_was_informed', new.time_was_informed);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_event_time_metadata on public.interpreted_contents;
create trigger sync_event_time_metadata
before insert or update of event_date, time_was_informed, extracted_data
on public.interpreted_contents
for each row execute function public.sync_event_time_metadata();

-- Garante o mesmo contrato para publicações aprovadas da comunidade.
create or replace function public.publish_community_event(submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.community_event_submissions;
  target_id uuid;
  event_instant timestamptz;
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

  event_instant :=
    (source.event_date + coalesce(source.start_time, time '00:00:00'))
    at time zone 'America/Sao_Paulo';

  select id into target_id
  from public.interpreted_contents
  where lower(trim(title)) = lower(trim(source.title))
    and (timezone('America/Sao_Paulo', event_date))::date = source.event_date
    and lower(coalesce(city,'')) = lower(coalesce(source.city,''))
    and review_status = 'publicado'
  limit 1;

  if target_id is not null then
    update public.community_event_submissions
    set duplicate_of = target_id, status = 'changes_requested',
        moderation_notes = 'Possível duplicidade: já existe um evento com mesmo título, data e cidade.',
        updated_at = now()
    where id = submission_id;
    return null;
  end if;

  insert into public.interpreted_contents (
    title, category, summary, full_description, event_date, time_was_informed,
    location, city, price, contact_name, contact_phone, source_url, image_url, keywords,
    extracted_data, confidence_score, model_used, prompt_version,
    review_status, reviewed_by, reviewed_at
  ) values (
    source.title, source.category, left(coalesce(source.description, source.source_text, ''), 280),
    coalesce(source.description, source.source_text),
    event_instant, source.start_time is not null,
    concat_ws(' — ', nullif(source.venue_name,''), nullif(source.address,'')),
    source.city, source.price_info, null, source.contact_info, source.ticket_url,
    source.cover_url, array['comunidade'],
    jsonb_build_object(
      'community_submission_id', source.id,
      'submitted_by', source.author_id,
      'source_timezone', 'America/Sao_Paulo',
      'time_was_informed', source.start_time is not null
    ),
    1, 'community-reviewed', 'community-v1.2', 'publicado', auth.uid(), now()
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
