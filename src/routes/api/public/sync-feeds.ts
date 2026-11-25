import { createFileRoute } from "@tanstack/react-router";
import { syncAllConfiguredFeedSources } from "@/lib/feed-sources.server";

function authorized(request: Request) {
  const secrets = [process.env["CRON_SECRET"], process.env["FEED_SYNC_SECRET"]].filter(Boolean);
  const header = request.headers.get("authorization") || "";
  return secrets.some((secret) => header === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret);
}

export const Route = createFileRoute("/api/public/sync-feeds")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ error: "Não autorizado" }, { status: 401 });
        }
        try {
          const result = await syncAllConfiguredFeedSources();
          const successful = result.filter((source) => source.ok).length;
          const failed = result.length - successful;
          const ok = failed === 0;
          const status = successful === 0 && failed > 0 ? 503 : ok ? 200 : 207;
          return Response.json(
            { ok, summary: { total: result.length, successful, failed }, result },
            { status },
          );
        } catch (error) {
          console.error("[feed-sync] Falha na sincronização:", error);
          return Response.json({ ok: false, error: "Falha interna na sincronização" }, { status: 500 });
        }
      },
    },
  },
});
