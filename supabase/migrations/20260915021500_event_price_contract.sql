-- Contrato canônico de preço sem quebrar a coluna legada `price text`.
-- Regras de armazenamento:
--   null = valor não informado
--   '0'  = gratuito / entrada franca
--   demais textos = valor fixo, faixa ou condição exatamente como informada
-- A classificação rica (free/paid/unknown) é derivada pela aplicação.

create or replace function public.normalize_event_price_storage(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when value is null or btrim(value) = '' then null
    when lower(btrim(value)) ~ '^(não informado|nao informado|sem informação|sem informacao|a definir)$' then null
    -- Só colapsamos para '0' quando a informação inteira significa gratuidade.
    -- Frases mistas como "gratuito para crianças / R$ 20 adultos" permanecem texto.
    when lower(btrim(value)) ~ '^(grátis|gratis|gratuito|gratuita|entrada franca)$'
      or lower(btrim(value)) ~ '^(r[$][[:space:]]*)?0([,.]00)?$' then '0'
    else regexp_replace(btrim(value), '[[:space:]]+', ' ', 'g')
  end;
$$;

comment on function public.normalize_event_price_storage(text) is
  'Normaliza o armazenamento de preço: null=desconhecido, 0=gratuito, texto=valor/condições informadas.';

create or replace function public.sync_event_price_contract()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.price := public.normalize_event_price_storage(new.price);
  return new;
end;
$$;

drop trigger if exists sync_event_price_contract on public.interpreted_contents;
create trigger sync_event_price_contract
before insert or update of price
on public.interpreted_contents
for each row execute function public.sync_event_price_contract();

-- Backfill conservador: apenas normaliza espaços, gratuitos explícitos e ausências.
-- Valores pagos e condições mistas existentes não são convertidos nem arredondados.
update public.interpreted_contents
set price = public.normalize_event_price_storage(price)
where price is distinct from public.normalize_event_price_storage(price);
