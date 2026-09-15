import { eventDateKey } from "@/lib/event-datetime";
import { eventPriceFilterKind, formatEventPrice } from "@/lib/event-price";
import { expandPublishedRecurringRows } from "@/lib/recurrence.server";
import { isPublishedReviewStatus } from "@/lib/workflow-status";

export type PublicEventSourceRow = Record<string, unknown> & {
  id?: unknown;
  review_status?: unknown;
  title?: unknown;
  event_date?: unknown;
  time_was_informed?: unknown;
  source_url?: unknown;
  location?: unknown;
  keywords?: unknown;
  price?: unknown;
  extracted_data?: unknown;
};

function timeWasInformed(row: PublicEventSourceRow) {
  if (typeof row.time_was_informed === "boolean") return row.time_was_informed;
  const extracted =
    row.extracted_data && typeof row.extracted_data === "object" && !Array.isArray(row.extracted_data)
      ? (row.extracted_data as Record<string, unknown>)
      : null;
  return typeof extracted?.time_was_informed === "boolean"
    ? extracted.time_was_informed
    : null;
}

/**
 * Contrato final entre revisão e agenda pública.
 *
 * A consulta no banco já busca `review_status = publicado`, mas repetimos a
 * verificação aqui como defesa em profundidade e para manter o comportamento
 * testável sem depender de um banco de produção. Assim, um registro ainda em
 * revisão nunca vira evento público por acidente durante uma refatoração.
 */
export function buildPublicAgendaEvents(
  rows: PublicEventSourceRow[],
  options: { now?: Date } = {},
) {
  const publishedRows = rows
    .filter((row) =>
      isPublishedReviewStatus(typeof row.review_status === "string" ? row.review_status : null),
    )
    .map((row) => {
      const eventDate = typeof row.event_date === "string" ? row.event_date : null;
      const publicEventDate =
        eventDate && timeWasInformed(row) === false ? eventDateKey(eventDate) : eventDate;
      const rawPrice =
        typeof row.price === "string" || typeof row.price === "number" ? row.price : null;

      return {
        ...row,
        id: String(row.id || ""),
        title: typeof row.title === "string" ? row.title : null,
        event_date: publicEventDate,
        source_url: typeof row.source_url === "string" ? row.source_url : null,
        location: typeof row.location === "string" ? row.location : null,
        keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : null,
        price_kind: eventPriceFilterKind(rawPrice),
        price_label: formatEventPrice(rawPrice),
      };
    });

  return expandPublishedRecurringRows(publishedRows, options);
}
