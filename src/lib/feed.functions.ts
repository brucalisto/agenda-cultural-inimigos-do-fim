import { createServerFn } from "@tanstack/react-start";
import { ingestDefaultFeeds } from "@/lib/feeds.server";

export const syncDefaultFeeds = createServerFn({ method: "POST" }).handler(async () => {
  return ingestDefaultFeeds();
});
