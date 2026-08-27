import { createFileRoute } from "@tanstack/react-router";
import { syncAllConfiguredFeedSources } from "@/lib/feed-sources.server";

function authorized(request: Request) {
  const expected = process.env["CRON_SECRET"] || process.env["FEED_SYNC_SECRET"];
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${expected}` || request.headers.get("x-cron-secret") === expected;
}

export const Route = createFileRoute("/api/public/sync-feeds")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ error: "Não autorizado" }, { status: 401 });
        }
        const result = await syncAllConfiguredFeedSources();
        return Response.json({ ok: true, result });
      },
    },
  },
});
