import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_events",
  title: "Buscar eventos",
  description: "Busca eventos por texto nos campos de título, resumo, categoria, cidade e local.",
  inputSchema: {
    query: z.string().describe("Texto a procurar na agenda."),
    limit: z.number().int().optional().describe("Quantidade máxima de resultados; padrão 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Autenticação necessária." }], isError: true };
    }

    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return { content: [{ type: "text", text: "Informe um texto para buscar." }], isError: true };
    const cappedLimit = Math.min(Math.max(limit ?? 20, 1), 100);
    const { data, error } = await supabaseForUser(ctx)
      .from("interpreted_contents")
      .select("id,title,category,summary,event_date,location,city,price,review_status,keywords,updated_at")
      .order("event_date", { ascending: true, nullsFirst: false })
      .limit(500);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const events = (data ?? []).filter((event) =>
      [event.title, event.summary, event.category, event.city, event.location, ...(event.keywords ?? [])]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(needle)),
    ).slice(0, cappedLimit);

    return {
      content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
      structuredContent: { events },
    };
  },
});