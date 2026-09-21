import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildPublicAgendaEvents } from "@/lib/public-events";

const coreColumns =
  "id,review_status,title,category,summary,full_description,event_date,location,city,price,contact_name,contact_phone,contact_instagram,source_url,keywords,confidence_score,updated_at,extracted_data";
const baseColumns = `${coreColumns},time_was_informed`;
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
            const minimal = await fetchPublishedRows(coreColumns);
            schemaMode = "minimal";
            truncated = minimal.truncated;

            if (minimal.error) {
              console.error("Falha ao carregar agenda pública:", minimal.error);
              return Response.json({ error: "Agenda indisponível" }, { status: 500 });
            }

            events = (minimal.data || []).map((event) => ({
              ...event,
              time_was_informed: null,
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
        const expandedEvents = buildPublicAgendaEvents(events || []);

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
