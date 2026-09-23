import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AssistedEventSchema = z.object({
  accessToken: z.string().min(1),
  sourceText: z.string().max(12_000).default(""),
  image: z.object({ mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().max(12_000_000) }).nullable().default(null),
});

function localDateParts(value: string | null, timeWasInformed: boolean) {
  if (!value) return { eventDate: "", startTime: "" };
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (match) return { eventDate: match[1], startTime: timeWasInformed ? match[2] : "" };
  return { eventDate: value.slice(0, 10), startTime: "" };
}

export const assistCommunityEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => AssistedEventSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { processWithAI } = await import("@/lib/gemini/service.server");
    const { data: auth, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !auth.user) throw new Error("Sua sessão expirou. Entre novamente.");
    if (!data.sourceText.trim() && !data.image) throw new Error("Cole uma divulgação, conte por voz ou envie uma imagem do evento.");

    const result = await processWithAI([
      "Interprete esta divulgação enviada pelo próprio organizador para preencher um formulário de evento.",
      "Não invente informações ausentes. Preserve a data e o horário locais informados.",
      data.sourceText.trim(),
    ].filter(Boolean).join("\n\n"), data.image ? [data.image] : []);
    const item = result.items[0];
    const date = localDateParts(item.event_date, item.time_was_informed);
    const contactInfo = [item.contact_name, item.contact_phone, item.contact_instagram].filter(Boolean).join(" · ");

    return {
      title: item.title ?? "", description: item.full_description || item.summary || "",
      event_date: date.eventDate, start_time: date.startTime, venue_name: item.location ?? "",
      city: item.city ?? "", price_info: item.price == null ? "" : item.price === 0 ? "Gratuito" : `R$ ${item.price.toFixed(2).replace(".", ",")}`,
      contact_info: contactInfo, ticket_url: item.source_url ?? "", category: item.category ?? "",
      ai_extracted_data: { provider: result.provider, model: result.modelUsed, confidence_score: item.confidence_score, missing_fields: item.missing_fields, warnings: item.warnings, extracted_data: item.extracted_data, detected_events: result.items.length },
      detectedEvents: result.items.length, warnings: item.warnings, missingFields: item.missing_fields,
    };
  });
