import { eventDateKey } from "@/lib/event-datetime";

export type DuplicateComparable = {
  title?: string | null;
  event_date?: string | null;
  location?: string | null;
  city?: string | null;
  source_url?: string | null;
};

export function normalizeDuplicateText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function duplicateTokenSimilarity(a?: string | null, b?: string | null) {
  const left = new Set(normalizeDuplicateText(a).split(" ").filter(Boolean));
  const right = new Set(normalizeDuplicateText(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / Math.max(left.size, right.size);
}

export function duplicateSameDay(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  const left = eventDateKey(a);
  const right = eventDateKey(b);
  return Boolean(left && right && left === right);
}

export function scoreDuplicatePair(event: DuplicateComparable, candidate: DuplicateComparable) {
  const title = duplicateTokenSimilarity(event.title, candidate.title);
  const location = Math.max(
    duplicateTokenSimilarity(event.location, candidate.location),
    duplicateTokenSimilarity(event.city, candidate.city),
  );
  const date = duplicateSameDay(event.event_date, candidate.event_date) ? 1 : 0;
  const exactTitle = Boolean(
    normalizeDuplicateText(event.title) &&
      normalizeDuplicateText(event.title) === normalizeDuplicateText(candidate.title),
  );
  const sameSource = Boolean(
    event.source_url && candidate.source_url && event.source_url === candidate.source_url,
  );

  const weighted = title * 0.6 + date * 0.25 + location * 0.15 + (sameSource ? 0.05 : 0);
  const total = exactTitle && date === 1 ? Math.max(0.93, weighted) : Math.min(1, weighted);
  const reasons = [
    exactTitle && "mesmo título normalizado",
    title >= 0.7 && "título muito parecido",
    date === 1 && "mesma data",
    location >= 0.6 && "local/cidade parecido",
    sameSource && "mesma URL de origem",
  ].filter(Boolean) as string[];

  return { total, reasons };
}
