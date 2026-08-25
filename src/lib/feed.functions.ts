import { createServerFn } from "@tanstack/react-start";
import { ingestDefaultFeeds, ingestLegacyNotionExport } from "@/lib/feeds.server";

export const syncDefaultFeeds = createServerFn({ method: "POST" }).handler(async () => {
  return ingestDefaultFeeds();
});

export const importLegacyNotionAgenda = createServerFn({ method: "POST" }).handler(async () => {
  return ingestLegacyNotionExport();
});
