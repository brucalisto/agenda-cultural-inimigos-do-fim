import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseBaileysWebhook } from "@/lib/adapters/baileys.server";
import { processBaileysMessage } from "@/lib/processing.server";
import {
  normalizeWhatsAppGroupId,
  normalizeWhatsAppGroupName,
} from "@/lib/whatsapp-groups";

export const reprocessWebhookEvent = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ eventId: z.string().uuid(), accessToken: z.string().min(1) }).parse(data),
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
    if (profile?.role !== "admin")
      throw new Error("Somente administradores podem reprocessar webhooks.");

    const { data: event, error } = await supabaseAdmin
      .from("webhook_events")
      .select("*")
      .eq("id", data.eventId)
      .single();
    if (error || !event) throw new Error("Evento de webhook não encontrado.");

    const payload = parseBaileysWebhook(event.payload);
    const externalGroupId = normalizeWhatsAppGroupId(payload.groupId);
    const incomingGroupName = normalizeWhatsAppGroupName(payload.groupName);

    let { data: group, error: groupError } = await supabaseAdmin
      .from("whatsapp_groups")
      .select("*")
      .eq("external_group_id", externalGroupId)
      .maybeSingle();
    if (groupError) throw groupError;

    if (!group?.ativo || !group?.autorizado) {
      const { data: authorizedGroups, error: authorizedGroupsError } = await supabaseAdmin
        .from("whatsapp_groups")
        .select("*")
        .eq("ativo", true)
        .eq("autorizado", true)
        .limit(100);
      if (authorizedGroupsError) throw authorizedGroupsError;

      const sameName = (authorizedGroups || []).filter(
        (candidate) => normalizeWhatsAppGroupName(candidate.nome || "") === incomingGroupName,
      );
      if (sameName.length === 1) group = sameName[0];
    }

    if (!group?.ativo || !group?.autorizado)
      throw new Error(
        `Ative e autorize o grupo antes de reprocessar este evento (${payload.groupName} · ${externalGroupId}).`,
      );

    const started = Date.now();
    try {
      const result = await processBaileysMessage(payload, group.id);
      await supabaseAdmin
        .from("webhook_events")
        .update({
          processing_status: "processed",
          error_message: null,
          http_status: 200,
          processed_at: new Date().toISOString(),
          processing_duration_ms: Date.now() - started,
        })
        .eq("id", event.id);
      return { success: true, ...result };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Falha no reprocessamento";
      await supabaseAdmin
        .from("webhook_events")
        .update({
          processing_status: "error",
          error_message: message,
          http_status: 500,
          processed_at: new Date().toISOString(),
          processing_duration_ms: Date.now() - started,
        })
        .eq("id", event.id);
      throw cause;
    }
  });
