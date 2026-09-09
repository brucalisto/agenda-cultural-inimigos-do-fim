type CulturalEventCandidate = {
  is_event?: boolean | null;
  title?: string | null;
  category?: string | null;
  event_date?: string | null;
  location?: string | null;
  missing_fields?: string[] | null;
};

function normalizeCategory(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isCulturalEvent(item: CulturalEventCandidate) {
  if (typeof item.is_event === "boolean") return item.is_event;

  const category = normalizeCategory(item.category);
  if (["", "outro", "noticia", "aviso", "promocao", "n/a"].includes(category)) return false;
  if (!item.title || /^sem t[ií]tulo$/i.test(item.title.trim())) return false;

  return Boolean(
    item.event_date ||
      item.location ||
      item.missing_fields?.some((field) => /data|hor[aá]rio|local/i.test(field)),
  );
}
