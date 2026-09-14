import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_event",
  title: "Atualizar evento",
  description: "Corrige campos editoriais de um evento conforme as permissões do usuário conectado.",
  inputSchema: {
    id: z.string().uuid().describe("Identificador do evento."),
    title: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    full_description: z.string().nullable().optional(),
    event_date: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    price: z.string().nullable().optional(),
    source_url: z.string().nullable().optional(),
    review_status: z.string().optional(),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ id, ...changes }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Autenticação necessária." }], isError: true };
    }

    const updates = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
    if (Object.keys(updates).length === 0) {
      return { content: [{ type: "text", text: "Informe ao menos um campo para atualizar." }], isError: true };
    }

    const { data, error } = await supabaseForUser(ctx)
      .from("interpreted_contents")
      .update(updates)
      .eq("id", id)
      .select("id,title,category,summary,event_date,location,city,price,source_url,review_status,updated_at")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Evento não encontrado ou sem permissão para edição." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { event: data },
    };
  },
});