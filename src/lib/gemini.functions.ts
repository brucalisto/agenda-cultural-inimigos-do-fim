import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { processWithGemini } from "./gemini/service.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { GEMINI_CONFIG } from "./gemini/config.server";

export const reprocessMessage = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ messageId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { messageId } = data;

    // 1. Fetch message data
    const { data: message, error: fetchError } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("*, group:whatsapp_groups(*), media:message_media(*)")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      throw new Error("Message not found");
    }

    // 2. Prepare media if available
    // In a real scenario, we would download from bucket or use source_url
    // For now, we focus on the text and metadata extraction
    const contentToAnalyze = `
      Grupo: ${message.group?.nome || "Desconhecido"}
      Remetente: ${message.sender_name || "Desconhecido"}
      Texto: ${message.text_content || ""}
      Legenda: ${message.caption || ""}
    `;

    try {
      // Update status to processing
      await supabaseAdmin
        .from("whatsapp_messages")
        .update({ processing_status: "processando" })
        .eq("id", messageId);

      // 3. Call Gemini
      const interpretation = await processWithGemini(contentToAnalyze);

      // 4. Save interpreted content
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "administrador")
        .limit(1)
        .single();

      const { error: insertError } = await supabaseAdmin
        .from("interpreted_contents")
        .upsert({
          message_id: messageId,
          title: interpretation.title,
          category: interpretation.category,
          summary: interpretation.summary,
          full_description: interpretation.full_description,
          event_date: interpretation.event_date,
          location: interpretation.location,
          price: interpretation.price?.toString(),
          contact_name: interpretation.contact_name,
          contact_phone: interpretation.contact_phone,
          source_url: interpretation.source_url,
          keywords: interpretation.keywords,
          missing_fields: interpretation.missing_fields,
          warnings: interpretation.warnings,
          confidence_score: interpretation.confidence_score,
          model_used: GEMINI_CONFIG.MODEL_NAME,
          prompt_version: GEMINI_CONFIG.PROMPT_VERSION,
          review_status: (interpretation.confidence_score < 0.7 || interpretation.missing_fields.length > 0) 
            ? "necessita_revisao" 
            : "pendente"
        }, { onConflict: "message_id" });

      if (insertError) throw insertError;

      // 5. Update message status
      await supabaseAdmin
        .from("whatsapp_messages")
        .update({ 
          processing_status: interpretation.confidence_score < 0.7 ? "necessita_revisao" : "interpretado" 
        })
        .eq("id", messageId);

      return { success: true, interpretation };
    } catch (error: any) {
      console.error("Gemini Processing Error:", error);
      
      await supabaseAdmin
        .from("whatsapp_messages")
        .update({ 
          processing_status: "erro",
          error_message: error.message 
        })
        .eq("id", messageId);

      throw error;
    }
  });
