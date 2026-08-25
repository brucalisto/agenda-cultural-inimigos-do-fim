import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/events")({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin
          .from("interpreted_contents")
          .select(
            "id,title,category,summary,full_description,event_date,location,city,price,contact_name,contact_phone,contact_instagram,source_url,keywords,confidence_score,updated_at,is_featured,featured_priority,featured_starts_at,featured_ends_at,latitude,longitude",
          )
          .eq("review_status", "publicado")
          .not("event_date", "is", null)
          .order("event_date", { ascending: true })
          .limit(2000);
        if (error) return Response.json({ error: "Agenda indisponível" }, { status: 500 });
        return Response.json(
          { events: data },
          { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
        );
      },
    },
  },
});
