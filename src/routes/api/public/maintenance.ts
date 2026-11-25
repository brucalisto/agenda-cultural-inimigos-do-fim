import { createFileRoute } from "@tanstack/react-router";
import { geocodePublishedEvents } from "@/lib/event-geocoding.server";

function authorized(request: Request) {
  const secrets = [process.env["CRON_SECRET"], process.env["FEED_SYNC_SECRET"]].filter(Boolean);
  const header = request.headers.get("authorization") || "";
  return secrets.some((secret) => header === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret);
}

export const Route = createFileRoute("/api/public/maintenance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ error: "Não autorizado" }, { status: 401 });
        }

        try {
          const geocoding = await geocodePublishedEvents();
          return Response.json({ ok: true, geocoding });
        } catch (error) {
          console.error("Falha na manutenção da agenda:", error);
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Falha na manutenção da agenda",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
