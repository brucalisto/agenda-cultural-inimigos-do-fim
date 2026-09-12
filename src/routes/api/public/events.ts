import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { expandPublishedRecurringRows } from "@/lib/recurrence.server";

const baseColumns =
  "id,title,category,summary,full_description,event_date,location,city,price,contact_name,contact_phone,contact_instagram,source_url,keywords,confidence_score,updated_at,extracted_data";
const curatedColumns = `${baseColumns},image_url,is_featured,featured_priority,featured_starts_at,featured_ends_at,latitude,longitude`;

function baseRecordId(id: string) {
  return id.split("::")[0];
}

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

      POST: async ({ request }) => {
        let body: { id?: string };
        try {
          body = (await request.json()) as { id?: string };
        } catch {
          return Response.json({ error: "Payload inválido" }, { status: 400 });
        }

        if (!body.id) return Response.json({ error: "Evento não informado" }, { status: 400 });
        const recordId = baseRecordId(body.id);

        const current = await supabaseAdmin
          .from("interpreted_contents")
          .select("id,location,city,review_status,latitude,longitude")
          .eq("id", recordId)
          .eq("review_status", "publicado")
          .maybeSingle();

        if (current.error) {
          console.error("Falha ao consultar coordenadas do evento:", current.error);
          return Response.json(
            { error: "Coordenadas ainda não disponíveis. A migração do banco pode estar pendente." },
            { status: 409 },
          );
        }

        if (!current.data) return Response.json({ error: "Evento não encontrado" }, { status: 404 });

        if (Number.isFinite(current.data.latitude) && Number.isFinite(current.data.longitude)) {
          return Response.json({
            latitude: current.data.latitude,
            longitude: current.data.longitude,
            cached: true,
          });
        }

        const address = [current.data.location, current.data.city, "Brasil"]
          .filter(Boolean)
          .join(", ")
          .replace(/\s+/g, " ")
          .trim();

        if (!address || address === "Brasil") {
          return Response.json({ error: "Evento sem endereço suficiente" }, { status: 422 });
        }

        try {
          const url = new URL("https://nominatim.openstreetmap.org/search");
          url.searchParams.set("format", "jsonv2");
          url.searchParams.set("limit", "1");
          url.searchParams.set("countrycodes", "br");
          url.searchParams.set("q", address);

          const response = await fetch(url, {
            headers: {
              "User-Agent": "AgendaCulturalInimigosDoFim/1.0",
              "Accept-Language": "pt-BR,pt;q=0.9",
            },
          });

          if (!response.ok) {
            return Response.json({ error: "Serviço de localização indisponível" }, { status: 503 });
          }

          const matches = (await response.json()) as Array<{ lat?: string; lon?: string }>;
          const latitude = Number(matches[0]?.lat);
          const longitude = Number(matches[0]?.lon);

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return Response.json({ error: "Endereço não localizado" }, { status: 404 });
          }

          const saved = await supabaseAdmin
            .from("interpreted_contents")
            .update({ latitude, longitude })
            .eq("id", recordId)
            .eq("review_status", "publicado");

          if (saved.error) {
            console.error("Falha ao salvar coordenadas do evento:", saved.error);
            return Response.json({ error: "Não foi possível salvar as coordenadas" }, { status: 500 });
          }

          return Response.json({ latitude, longitude, cached: false });
        } catch (error) {
          console.error("Falha ao geocodificar evento:", error);
          return Response.json({ error: "Não foi possível localizar o endereço" }, { status: 500 });
        }
      },
    },
  },
});
