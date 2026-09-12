import { prepareRecurringItemsForReview } from "@/lib/recurrence.server";
import type { InterpretedContentResponse } from "@/lib/gemini/schema";

export type FeedEventLike = {
  title?: string | null;
  category?: string | null;
  summary?: string | null;
  full_description?: string | null;
  event_date?: string | null;
  location?: string | null;
  city?: string | null;
  price?: string | number | null;
  source_url?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_instagram?: string | null;
  keywords?: string[] | null;
  missing_fields?: string[] | null;
  warnings?: string[] | null;
  confidence_score?: number | null;
  extracted_data?: Record<string, unknown> | null;
};

type ConsolidationOptions = {
  sourceName?: string;
  sourceUrl?: string;
};

function normalize(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function day(value?: string | null) {
  return value && !Number.isNaN(new Date(value).getTime()) ? value.slice(0, 10) : "sem-data";
}

export function feedEventIdentity(item: FeedEventLike) {
  const place = normalize(item.location) || normalize(item.city);
  return `${normalize(item.title)}|${day(item.event_date)}|${place}`;
}

function time(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(11, 16);
}

function first<T>(...values: Array<T | null | undefined>) {
  return values.find((value) => value !== null && value !== undefined && value !== "") ?? null;
}

function supportsRecurrencePreparation(item: FeedEventLike): item is FeedEventLike & InterpretedContentResponse {
  return (
    Array.isArray(item.keywords) &&
    Array.isArray(item.missing_fields) &&
    Array.isArray(item.warnings) &&
    typeof item.confidence_score === "number" &&
    Object.prototype.hasOwnProperty.call(item, "price")
  );
}

function prepareRecurrenceWhenApplicable<T extends FeedEventLike>(
  items: T[],
  options: ConsolidationOptions,
) {
  if (!items.length || !items.every(supportsRecurrencePreparation)) return items;
  return prepareRecurringItemsForReview(
    items as unknown as InterpretedContentResponse[],
    options,
  ) as unknown as T[];
}

/**
 * Consolida duplicidades do mesmo evento dentro de uma única fonte, mas mantém
 * recorrências como UM registro-base durante a revisão. A expansão semanal acontece
 * somente quando a agenda pública é consultada, depois da aprovação editorial.
 */
export function consolidateFeedEvents<T extends FeedEventLike>(
  inputItems: T[],
  options: ConsolidationOptions = {},
) {
  const items = prepareRecurrenceWhenApplicable(inputItems, options);
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = feedEventIdentity(item);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const sorted = [...group].sort((a, b) =>
      (a.event_date || "").localeCompare(b.event_date || ""),
    );
    const times = [
      ...new Set(sorted.map((item) => time(item.event_date)).filter(Boolean) as string[]),
    ];
    const readableTimes = times.map((value) => value.replace(":00", "h").replace(":", "h"));
    const summaries = [
      ...new Set(sorted.map((item) => item.summary?.trim()).filter(Boolean) as string[]),
    ];
    const descriptions = [
      ...new Set(sorted.map((item) => item.full_description?.trim()).filter(Boolean) as string[]),
    ];
    const primary = sorted[0];
    return {
      ...primary,
      category: first(...sorted.map((item) => item.category)),
      location: first(...sorted.map((item) => item.location)),
      city: first(...sorted.map((item) => item.city)),
      price: first(...sorted.map((item) => item.price)),
      source_url: first(...sorted.map((item) => item.source_url)),
      contact_name: first(...sorted.map((item) => item.contact_name)),
      contact_phone: first(...sorted.map((item) => item.contact_phone)),
      contact_instagram: first(...sorted.map((item) => item.contact_instagram)),
      summary: [
        readableTimes.length > 1 ? `Horários: ${readableTimes.join(" e ")}.` : null,
        ...summaries,
      ]
        .filter(Boolean)
        .join(" "),
      full_description: descriptions.join("\n\n"),
      extracted_data: {
        ...(primary.extracted_data || {}),
        eventTimes: times,
        consolidatedOccurrences: group.length,
      },
    } as T;
  });
}
