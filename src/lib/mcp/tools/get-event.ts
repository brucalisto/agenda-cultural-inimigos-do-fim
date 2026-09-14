import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_event",
  title: "Consultar evento",
  description: "Consulta os detalhes e a origem de um evento pelo identificador.",
  inputSchema: { id: z.string().uuid().describe("Identificador do evento.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Autenticação necessária." }], isError: true };
    }

    const { data, error } = await supabaseForUser(ctx)
      .from("interpreted_contents")
      .select(`
        *,
        whatsapp_messages (
          text_content,
          sender_name,
          occurred_at,
          whatsapp_groups (nome),
          extracted_links (original_url,page_title)
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Evento não encontrado." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { event: data },
    };
  },
});