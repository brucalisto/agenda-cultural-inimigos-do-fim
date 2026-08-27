import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const createEventImage = createServerFn({ method: "POST" })
  .inputValidator((value) =>
    z.object({ accessToken: z.string().min(1), eventId: z.string().uuid() }).parse(value),
  )
  .handler(async ({ data }) => {
    const { generateEventImage } = await import("@/lib/event-images.server");
    return generateEventImage(data.accessToken, data.eventId);
  });
