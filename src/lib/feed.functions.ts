import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const authSchema = z.object({ accessToken: z.string().min(1) });

export const syncDefaultFeeds = createServerFn({ method: "POST" })
  .inputValidator((value) => authSchema.parse(value))
  .handler(async ({ data }) => {
    const [{ requireAdminAccess }, { ingestDefaultFeeds }] = await Promise.all([
      import("@/lib/feed-sources.server"),
      import("@/lib/feeds.server"),
    ]);
    await requireAdminAccess(data.accessToken);
    return ingestDefaultFeeds();
  });

export const importLegacyNotionAgenda = createServerFn({ method: "POST" })
  .inputValidator((value) => authSchema.parse(value))
  .handler(async ({ data }) => {
    const [{ requireAdminAccess }, { ingestCurrentNotionExport }] = await Promise.all([
      import("@/lib/feed-sources.server"),
      import("@/lib/legacy-notion-current.server"),
    ]);
    await requireAdminAccess(data.accessToken);
    return ingestCurrentNotionExport();
  });
