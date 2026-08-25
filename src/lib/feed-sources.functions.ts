import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const authSchema = z.object({ accessToken: z.string().min(1) });

export const listFeedSources = createServerFn({ method: "POST" })
  .inputValidator((value) => authSchema.parse(value))
  .handler(async ({ data }) => {
    const { listFeedSourcesForAdmin } = await import("@/lib/feed-sources.server");
    return listFeedSourcesForAdmin(data.accessToken);
  });

export const saveFeedSource = createServerFn({ method: "POST" })
  .inputValidator((value) =>
    authSchema.extend({
      id: z.string().uuid().optional(),
      name: z.string().min(1),
      url: z.string().url(),
      active: z.boolean(),
      trusted: z.boolean(),
      autoPublish: z.boolean(),
    }).parse(value),
  )
  .handler(async ({ data }) => {
    const { saveFeedSourceForAdmin } = await import("@/lib/feed-sources.server");
    return saveFeedSourceForAdmin(data.accessToken, data);
  });

export const deleteFeedSource = createServerFn({ method: "POST" })
  .inputValidator((value) => authSchema.extend({ id: z.string().uuid() }).parse(value))
  .handler(async ({ data }) => {
    const { removeFeedSourceForAdmin } = await import("@/lib/feed-sources.server");
    return removeFeedSourceForAdmin(data.accessToken, data.id);
  });

export const syncFeedSource = createServerFn({ method: "POST" })
  .inputValidator((value) => authSchema.extend({ id: z.string().uuid() }).parse(value))
  .handler(async ({ data }) => {
    const { syncFeedSourceForAdmin } = await import("@/lib/feed-sources.server");
    return syncFeedSourceForAdmin(data.accessToken, data.id);
  });

export const legacyNotionImportStatus = createServerFn({ method: "POST" })
  .inputValidator((value) => authSchema.parse(value))
  .handler(async ({ data }) => {
    const { getLegacyNotionStatus } = await import("@/lib/feed-sources.server");
    return getLegacyNotionStatus(data.accessToken);
  });
