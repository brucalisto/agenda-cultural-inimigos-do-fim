-- Correção pontual de um registro importado antes de a agenda normalizar o
-- fuso horário da extração por IA. A publicação informa 19h em Caraguatatuba,
-- mas o valor antigo foi salvo como 19:00 UTC e, por isso, aparecia 16h no
-- horário de São Paulo.
--
-- A condição sobre o valor antigo torna esta migração idempotente e evita
-- alterar o registro caso ele já tenha sido corrigido manualmente.
UPDATE public.interpreted_contents
SET
  event_date = '2026-09-27 19:00:00-03'::timestamptz,
  updated_at = now()
WHERE source_url ILIKE '%instagram.com/p/DctWxGEfapO/%'
  AND title ILIKE '%Esphera%'
  AND event_date = '2026-09-27 19:00:00+00'::timestamptz;
