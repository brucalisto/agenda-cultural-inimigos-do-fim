import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { expandPublishedRecurringRows } from "@/lib/recurrence.server";

const baseColumns =
  "id,title,category,summary,full_description,event_date,location,city,price,contact_name,contact_phone,contact_instagram,source_url,keywords,confidence_score,updated_at,extracted_data";
const curatedColumns = `${baseColumns},image_url,is_featured,featured_priority,featured_starts_at,featured_ends_at,latitude,longitude`;

function publicEvents(rows: Array<Record<string, unknown>>) {
  return expandPublishedRecurringRows(
    rows.map((row) => ({
      ...row,
      id: String(row.id || ""),
      title: typeof row.title === "string" ? row.title : null,
      event_date: typeof row.event_date === "string" ? row.event_date : null,
      source_url: typeof row.source_url === "string" ? row.source_url : null,
      location: typeof row.location === "string" ? row.location : null,
      keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : null,
    })),
  );
}

export const Route = createFileRoute("/api/public/events")({
  server: {
    handlers: {
      GET: async () => {
        const curated = await supabaseAdmin
          .from("interpreted_contents")
          .select(curatedColumns)
          .eq("review_status", "publicado")
          .order("event_date", { ascending: true, nullsFirst: false })
          .limit(2000);

        let events: Array<Record<string, unknown>> | null = (curated.data || null) as
          | Array<Record<string, unknown>>
          | null;

        if (curated.error) {
          const fallbackColumns = `${baseColumns},image_url,is_featured,featured_priority,featured_starts_at,featured_ends_at`;
          const fallback = await supabaseAdmin
            .from("interpreted_contents")
            .select(fallbackColumns)
            .eq("review_status", "publicado")
            .order("event_date", { ascending: true, nullsFirst: false })
            .limit(2000);

          if (fallback.error) {
            const minimal = await supabaseAdmin
              .from("interpreted_contents")
              .select(baseColumns)
              .eq("review_status", "publicado")
              .order("event_date", { ascending: true, nullsFirst: false })
              .limit(2000);

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

        return Response.json(
          { events: publicEvents(events || []) },
          { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=60" } },
        );
      },
    },
  },
});
