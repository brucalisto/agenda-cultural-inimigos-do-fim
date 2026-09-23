import { createFileRoute } from "@tanstack/react-router";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { todayEventDateKey } from "@/lib/event-datetime";

const PROFILE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/profile-events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const profileId = new URL(request.url).searchParams.get("profileId") ?? "";
        if (!PROFILE_ID_PATTERN.test(profileId)) {
          return Response.json({ error: "Perfil inválido" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
          .from("interpreted_contents")
          .select("id,title,category,summary,event_date,location,city,price,image_url")
          .in("review_status", ["publicado", "aprovado"])
          .eq("extracted_data->>submitted_by", profileId)
          .gte("event_date", `${todayEventDateKey()}T00:00:00-03:00`)
          .order("event_date", { ascending: true })
          .limit(12);

        if (error) {
          console.error("Falha ao carregar eventos do perfil:", error);
          return Response.json({ error: "Eventos indisponíveis" }, { status: 500 });
        }

        return Response.json(
          { events: data ?? [] },
          { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=120" } },
        );
      },
    },
  },
});
