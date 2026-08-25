import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/events")({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin
          .from("interpreted_contents")
          .select(
            "id,title,category,summary,full_description,event_date,location,city,price,contact_name,contact_phone,contact_instagram,source_url,keywords,confidence_score,updated_at",
          )
          .eq("review_status", "publicado")
          .not("event_date", "is", null)
          .order("event_date", { ascending: true })
          .limit(2000);

        if (error) {
          console.error("Falha ao carregar agenda pública:", error);
          return Response.json({ error: "Agenda indisponível" }, { status: 500 });
        }

        const events = (data || []).map((event) => ({
          ...event,
          // O banco publicado ainda não possui as colunas de curadoria/geolocalização.
          // Mantemos o contrato da página pública sem derrubar a agenda inteira.
          is_featured: false,
          featured_priority: 0,
          featured_starts_at: null,
          featured_ends_at: null,
          latitude: null,
          longitude: null,
        }));

        return Response.json(
          { events },
          { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=60" } },
        );
      },
    },
  },
});
