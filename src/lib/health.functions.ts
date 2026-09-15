import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ accessToken: z.string().min(1) });

export const getAgendaHealth = createServerFn({ method: "POST" })
  .inputValidator((value) => inputSchema.parse(value))
  .handler(async ({ data }) => {
    const { getAgendaHealthForAdmin } = await import("@/lib/health.server");
    return getAgendaHealthForAdmin(data.accessToken);
  });
