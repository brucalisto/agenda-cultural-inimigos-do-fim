import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { eventDateKey } from "@/lib/event-datetime";
import { eventPriceFilterKind, formatEventPrice } from "@/lib/event-price";
import { expandPublishedRecurringRows } from "@/lib/recurrence.server";

const baseColumns =
  "id,title,category,summary,full_description,event_date,location,city,price,contact_name,contact_phone,contact_instagram,source_url,keywords,confidence_score,updated_at,extracted_data";
const curatedColumns = `${baseColumns},image_url,is_featured,featured_priority,featured_starts_at,featured_ends_at,latitude,longitude`;
const PUBLIC_PAGE_SIZE = 500;
const PUBLIC_MAX_SOURCE_ROWS = 10_000;

type PublishedRowsResult = {
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
  truncated: boolean;
};

async function fetchPublishedRows(columns: string): Promise<PublishedRowsResult> {
  const rows: Array<Record<string, unknown>> = [];

  for (let from = 0; from < PUBLIC_MAX_SOURCE_ROWS; from += PUBLIC_PAGE_SIZE) {
    const to = Math.min(from + PUBLIC_PAGE_SIZE - 1, PUBLIC_MAX_SOURCE_ROWS - 1);
    const page = await supabaseAdmin
      .from("interpreted_contents")
      .select(columns)
      .eq("review_status", "publicado")
      .order("event_date", { ascending: true, nullsFirst: false })
      .range(from, to);

    if (page.error) {
      return { data: null, error: { message: page.error.message }, truncated: false };
    }

    const pageRows = (page.data || []) as Array<Record<string, unknown>>;
    rows.push(...pageRows);

    if (pageRows.length < PUBLIC_PAGE_SIZE) {
      return { data: rows, error: null, truncated: false };
    }
  }

  return { data: rows, error: null, truncated: true };
}

function timeWasInformed(row: Record<string, unknown>) {
  if (typeof row.time_was_informed === "boolean") return row.time_was_informed;
  const extracted =
    row.extracted_data && typeof row.extracted_data === "object" && !Array.isArray(row.extracted_data)
      ? (row.extracted_data as Record<string, unknown>)
      : null;
  return typeof extracted?.time_was_informed === "boolean"
    ? extracted.time_was_informed
    : null;
}

function publicEvents(rows: Array<Record<string, unknown>>) {
  return expandPublishedRecurringRows(
    rows.map((row) => {
      const eventDate = typeof row.event_date === "string" ? row.event_date : null;
      const publicEventDate =
        eventDate && timeWasInformed(row) === false ? eventDateKey(eventDate) : eventDate;
      const rawPrice =
        typeof row.price === "string" || typeof row.price === "number" ? row.price : null;

      return {
        ...row,
        id: String(row.id || ""),
        title: typeof row.title === "string" ? row.title : null,
        // Para datas sem horário, a API pública devolve somente YYYY-MM-DD.
        // O frontend passa a exibir "Horário não informado" em vez de 00:00.
        event_date: publicEventDate,
        source_url: typeof row.source_url === "string" ? row.source_url : null,
        location: typeof row.location === "string" ? row.location : null,
        keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : null,
        // Mantemos `price` por compatibilidade e oferecemos também os campos
        // canônicos para clientes novos e para a futura Saúde da Agenda.
        price_kind: eventPriceFilterKind(rawPrice),
        price_label: formatEventPrice(rawPrice),
      };
    }),
  );
}

export const Route = createFileRoute("/api/public/events")({
  server: {
    handlers: {
      GET: async () => {
        const curated = await fetchPublishedRows(curatedColumns);
        let events = curated.data;
        let truncated = curated.truncated;
        let schemaMode: "curated" | "fallback" | "minimal" = "curated";

        if (curated.error) {
          const fallbackColumns = `${baseColumns},image_url,is_featured,featured_priority,featured_starts_at,featured_ends_at`;
          const fallback = await fetchPublishedRows(fallbackColumns);
          schemaMode = "fallback";
          truncated = fallback.truncated;

          if (fallback.error) {
            const minimal = await fetchPublishedRows(baseColumns);
            schemaMode = "minimal";
            truncated = minimal.truncated;

            if (minimal.error) {
              console.error("Falha ao carregar agenda pública:", minimal.error);
              return Response.json({ error: "Agenda indisponível" }, { status: 500 });
            }

            events = (minimal.data || []).map((event) => ({
              ...event,
              image_url: null,
              is_featured: false,
              featured_priority: 0,
              featured_starts_at: null,
              featured_ends_at: null,
              latitude: null,
              longitude: null,
            }));
          } else {
            events = (fallback.data || []).map((event) => ({
              ...event,
              latitude: null,
              longitude: null,
            }));
          }
        }

        if (truncated) {
          console.warn(
            `[agenda-publica] A consulta atingiu o teto de ${PUBLIC_MAX_SOURCE_ROWS} registros publicados.`,
          );
        }

        const sourceRows = events?.length || 0;
        const expandedEvents = publicEvents(events || []);

        return Response.json(
          {
            events: expandedEvents,
            meta: {
              sourceRows,
              returnedEvents: expandedEvents.length,
              truncated,
              schemaMode,
            },
          },
          { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=60" } },
        );
      },
    },
  },
});
