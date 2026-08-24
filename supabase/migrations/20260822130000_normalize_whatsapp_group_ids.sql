CREATE TEMP TABLE _whatsapp_group_merge ON COMMIT DROP AS
SELECT
  id,
  first_value(id) OVER (
    PARTITION BY lower(btrim(external_group_id))
    ORDER BY
      coalesce(autorizado, false) DESC,
      coalesce(ativo, false) DESC,
      (nullif(btrim(descricao), '') IS NOT NULL) DESC,
      created_at ASC,
      id ASC
  ) AS keeper_id
FROM public.whatsapp_groups;

UPDATE public.whatsapp_messages AS message
SET group_id = mapping.keeper_id
FROM _whatsapp_group_merge AS mapping
WHERE message.group_id = mapping.id
  AND mapping.id <> mapping.keeper_id;

WITH merged AS (
  SELECT
    mapping.keeper_id,
    bool_or(coalesce(group_record.ativo, false)) AS ativo,
    bool_or(coalesce(group_record.autorizado, false)) AS autorizado
  FROM _whatsapp_group_merge AS mapping
  JOIN public.whatsapp_groups AS group_record ON group_record.id = mapping.id
  GROUP BY mapping.keeper_id
)
UPDATE public.whatsapp_groups AS keeper
SET
  ativo = merged.ativo,
  autorizado = merged.autorizado
FROM merged
WHERE keeper.id = merged.keeper_id;

DELETE FROM public.whatsapp_groups AS group_record
USING _whatsapp_group_merge AS mapping
WHERE group_record.id = mapping.id
  AND mapping.id <> mapping.keeper_id;

UPDATE public.whatsapp_groups
SET external_group_id = lower(btrim(external_group_id));

CREATE OR REPLACE FUNCTION public.normalize_whatsapp_group_external_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.external_group_id := lower(btrim(NEW.external_group_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_whatsapp_group_external_id_trigger
ON public.whatsapp_groups;

CREATE TRIGGER normalize_whatsapp_group_external_id_trigger
BEFORE INSERT OR UPDATE OF external_group_id
ON public.whatsapp_groups
FOR EACH ROW
EXECUTE FUNCTION public.normalize_whatsapp_group_external_id();

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_groups_external_group_id_normalized_key
ON public.whatsapp_groups (lower(btrim(external_group_id)));
