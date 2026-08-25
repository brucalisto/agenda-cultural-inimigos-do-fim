import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BaileysWebhookSchema } from "@/lib/adapters/baileys.server";
import { processBaileysMessage } from "@/lib/processing.server";

export const reprocessMessage = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ messageId: z.string().uuid(), accessToken: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !auth.user)
      throw new Error("Sessão expirada. Entre novamente para reprocessar.");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();
    if (!profile || !["admin", "revisor"].includes(profile.role))
      throw new Error("Você não possui permissão para reprocessar mensagens.");

    const { data: message, error } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("id, group_id, raw_payload")
      .eq("id", data.messageId)
      .single();
    if (error || !message?.group_id || !message.raw_payload)
      throw new Error("Mensagem original não encontrada.");

    const payload = BaileysWebhookSchema.parse(message.raw_payload);
    const result = await processBaileysMessage(payload, message.group_id);
    return { success: true, ...result };
  });

export const reprocessMessages = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        messageIds: z.array(z.string().uuid()).min(1).max(100),
        accessToken: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !auth.user) throw new Error("Sessão expirada. Entre novamente.");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();
    if (!profile || !["admin", "revisor"].includes(profile.role)) {
      throw new Error("Você não possui permissão para reprocessar mensagens.");
    }

    const messageIds = [...new Set(data.messageIds)];
    const { data: messages, error } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("id, group_id, raw_payload, occurred_at")
      .in("id", messageIds)
      .order("occurred_at", { ascending: true });
    if (error) throw error;

    const failures: Array<{ messageId: string; error: string }> = [];
    let processed = 0;
    for (const message of messages || []) {
      if (!message.group_id || !message.raw_payload) continue;
      try {
        await processBaileysMessage(BaileysWebhookSchema.parse(message.raw_payload), message.group_id);
        processed += 1;
      } catch (cause) {
        failures.push({
          messageId: message.id,
          error: cause instanceof Error ? cause.message : "Falha desconhecida",
        });
      }
    }
    return { success: failures.length === 0, processed, failures };
  });
