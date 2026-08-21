import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
       // Ideally we'd redirect here, but for now we'll throw to the error component
       throw new Error("Não autorizado");
    }
    return { session };
  },
});
