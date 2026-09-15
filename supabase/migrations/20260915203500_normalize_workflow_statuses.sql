begin;

-- Consolida aliases antigos de review_status em um conjunto canônico.
update public.interpreted_contents
set review_status = 'pendente', updated_at = now()
where review_status is null or btrim(review_status) = '';

update public.interpreted_contents
set review_status = 'necessita_revisao', updated_at = now()
where lower(btrim(review_status)) in ('revisao', 'revisão', 'em_revisao', 'reprocessar');

update public.interpreted_contents
set review_status = 'publicado', updated_at = now()
where lower(btrim(review_status)) = 'aprovado';

-- Qualquer estado legado não reconhecido volta para revisão em vez de ficar invisível
-- em alguma das telas do fluxo.
update public.interpreted_contents
set review_status = 'necessita_revisao', updated_at = now()
where review_status is not null
  and lower(btrim(review_status)) not in (
    'pendente',
    'necessita_revisao',
    'publicado',
    'ignorado',
    'desativado'
  );

alter table public.interpreted_contents
  drop constraint if exists interpreted_contents_review_status_canonical_check;

alter table public.interpreted_contents
  add constraint interpreted_contents_review_status_canonical_check
  check (
    review_status is null
    or review_status in ('pendente', 'necessita_revisao', 'publicado', 'ignorado', 'desativado')
  );

-- Mantém o status da mensagem bruta coerente com o conjunto de itens
-- interpretados ligados a ela, independentemente da tela que alterou a revisão.
create or replace function public.sync_whatsapp_processing_status_from_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_message_id uuid;
  next_status public.processing_status;
begin
  if tg_op = 'DELETE' then
    target_message_id := old.message_id;
  else
    target_message_id := new.message_id;
  end if;

  if target_message_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select
    case
      when count(*) = 0 then 'ignorado'::public.processing_status
      when count(*) filter (
        where review_status = 'necessita_revisao'
           or lower(coalesce(review_status, '')) not in ('pendente', 'necessita_revisao', 'publicado', 'ignorado', 'desativado')
      ) > 0 then 'necessita_revisao'::public.processing_status
      when count(*) filter (where coalesce(review_status, 'pendente') = 'pendente') > 0
        then 'interpretado'::public.processing_status
      when count(*) filter (where review_status = 'publicado') > 0
        then 'publicado'::public.processing_status
      else 'ignorado'::public.processing_status
    end
  into next_status
  from public.interpreted_contents
  where message_id = target_message_id;

  update public.whatsapp_messages
  set processing_status = next_status,
      error_message = null
  where id = target_message_id
    and processing_status is distinct from next_status;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_whatsapp_processing_status_from_review
  on public.interpreted_contents;

create trigger trg_sync_whatsapp_processing_status_from_review
after insert or delete or update of review_status, message_id
on public.interpreted_contents
for each row
execute function public.sync_whatsapp_processing_status_from_review();

-- Backfill imediato para mensagens já existentes.
with derived as (
  select
    message_id,
    case
      when count(*) filter (where review_status = 'necessita_revisao') > 0
        then 'necessita_revisao'::public.processing_status
      when count(*) filter (where coalesce(review_status, 'pendente') = 'pendente') > 0
        then 'interpretado'::public.processing_status
      when count(*) filter (where review_status = 'publicado') > 0
        then 'publicado'::public.processing_status
      else 'ignorado'::public.processing_status
    end as processing_status
  from public.interpreted_contents
  where message_id is not null
  group by message_id
)
update public.whatsapp_messages as message
set processing_status = derived.processing_status,
    error_message = null
from derived
where message.id = derived.message_id
  and message.processing_status is distinct from derived.processing_status;

commit;
