import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (!session) {
      throw new Error("Unauthorized");
    }
    return { session };
  },
});
