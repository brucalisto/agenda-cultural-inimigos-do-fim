import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_agenda",
  title: "Listar agenda",
  description: "Lista eventos da agenda que o usuário conectado tem permissão para consultar.",
  inputSchema: {
    status: z.string().optional().describe("Status de revisão, como pendente ou publicado."),
    limit: z.number().int().optional().describe("Quantidade máxima de eventos; padrão 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Autenticação necessária." }], isError: true };
    }

    const cappedLimit = Math.min(Math.max(limit ?? 50, 1), 200);
    let query = supabaseForUser(ctx)
      .from("interpreted_contents")
      .select("id,title,category,summary,event_date,location,city,price,review_status,updated_at")
      .order("event_date", { ascending: true, nullsFirst: false })
      .limit(cappedLimit);
    if (status?.trim()) query = query.eq("review_status", status.trim());

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const events = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
      structuredContent: { events },
    };
  },
});