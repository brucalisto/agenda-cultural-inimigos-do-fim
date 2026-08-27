import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/events")({
  server: {
    handlers: {
      GET: async () => {
        const baseColumns =
          "id,title,category,summary,full_description,event_date,location,city,price,contact_name,contact_phone,contact_instagram,source_url,keywords,confidence_score,updated_at";
        const curatedColumns = `${baseColumns},image_url,is_featured,featured_priority,featured_starts_at,featured_ends_at,latitude,longitude`;
        const curated = await supabaseAdmin
          .from("interpreted_contents")
          .select(curatedColumns)
          .eq("review_status", "publicado")
          .not("event_date", "is", null)
          .order("event_date", { ascending: true })
          .limit(2000);

        let events = curated.data;
        if (curated.error) {
          const fallback = await supabaseAdmin
            .from("interpreted_contents")
            .select(baseColumns)
            .eq("review_status", "publicado")
            .not("event_date", "is", null)
            .order("event_date", { ascending: true })
            .limit(2000);
          if (fallback.error) {
            console.error("Falha ao carregar agenda pública:", fallback.error);
            return Response.json({ error: "Agenda indisponível" }, { status: 500 });
          }
          events = (fallback.data || []).map((event) => ({
            ...event,
            image_url: null,
            is_featured: false,
            featured_priority: 0,
            featured_starts_at: null,
            featured_ends_at: null,
            latitude: null,
            longitude: null,
          }));
        }

        return Response.json(
          { events: events || [] },
          { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=60" } },
        );
      },
    },
  },
});
