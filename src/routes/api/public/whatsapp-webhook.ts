import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isNonEditorialContentType, parseBaileysWebhook } from "@/lib/adapters/baileys.server";
import { processBaileysMessage } from "@/lib/processing.server";
import {
  normalizeWhatsAppGroupId,
  normalizeWhatsAppGroupName,
} from "@/lib/whatsapp-groups";

function validSignature(body: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const received = Buffer.from(signature.slice(7));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function formatProcessingError(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "object" && cause) {
    const value = cause as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const parts = [
      value.message && String(value.message),
      value.code && `código ${String(value.code)}`,
      value.details && String(value.details),
      value.hint && `dica: ${String(value.hint)}`,
    ].filter(Boolean);
    if (parts.length) return parts.join(" · ");
    try {
      return JSON.stringify(cause).slice(0, 1000);
    } catch {
      return "Falha de processamento sem detalhes serializáveis";
    }
  }
  return String(cause || "Falha de processamento sem detalhes");
}

export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        const body = await request.text();
        if (body.length > 2_000_000) return new Response("Payload too large", { status: 413 });
        const secret = process.env["WHATSAPP_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook secret missing", { status: 500 });
        if (!validSignature(body, request.headers.get("x-baileys-signature"), secret))
          return new Response("Unauthorized", { status: 401 });
        let payload;
        try {
          payload = parseBaileysWebhook(JSON.parse(body));
        } catch {
          return new Response("Invalid Baileys payload", { status: 400 });
        }
        const db = supabaseAdmin;
        const { data: event, error: eventError } = await db
          .from("webhook_events")
          .insert({
            provider: "baileys",
            event_type: "messages.upsert",
            external_event_id: payload.eventId,
            payload,
            processing_status: "received",
            received_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (eventError || !event) throw eventError || new Error("Falha ao registrar webhook");
        try {
          if (isNonEditorialContentType(payload.contentType)) {
            await db
              .from("webhook_events")
              .update({
                processing_status: "ignored",
                error_message: "Reação de mensagem filtrada do fluxo editorial",
                processed_at: new Date().toISOString(),
                processing_duration_ms: Date.now() - started,
                http_status: 200,
              })
              .eq("id", event.id);
            return Response.json({ ok: true, ignored: true, reason: "non_editorial_interaction" });
          }

          const externalGroupId = normalizeWhatsAppGroupId(payload.groupId);
          const incomingGroupName = normalizeWhatsAppGroupName(payload.groupName);

          let { data: group, error: groupLookupError } = await db
            .from("whatsapp_groups")
            .select("*")
            .eq("external_group_id", externalGroupId)
            .maybeSingle();
          if (groupLookupError) throw groupLookupError;

          if (!group?.ativo || !group?.autorizado) {
            const { data: authorizedGroups, error: authorizedGroupsError } = await db
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

          if (!group) {
            const inserted = await db
              .from("whatsapp_groups")
              .insert({
                external_group_id: externalGroupId,
                nome: payload.groupName,
                ativo: false,
                autorizado: false,
              })
              .select()
              .single();
            if (inserted.error?.code === "23505") {
              const concurrent = await db
                .from("whatsapp_groups")
                .select("*")
                .eq("external_group_id", externalGroupId)
                .single();
              if (concurrent.error) throw concurrent.error;
              group = concurrent.data;
            } else {
              if (inserted.error) throw inserted.error;
              group = inserted.data;
            }
          } else if (group.nome !== payload.groupName) {
            await db
              .from("whatsapp_groups")
              .update({ nome: payload.groupName, updated_at: new Date().toISOString() })
              .eq("id", group.id);
          }

          if (!group?.ativo || !group?.autorizado) {
            await db
              .from("webhook_events")
              .update({
                processing_status: "ignored",
                error_message: `Grupo detectado, mas não autorizado (${payload.groupName} · ${externalGroupId})`,
                processed_at: new Date().toISOString(),
                processing_duration_ms: Date.now() - started,
                http_status: 200,
              })
              .eq("id", event.id);
            return Response.json({ ok: true, ignored: true });
          }

          const result = await processBaileysMessage(payload, group.id);
          await db
            .from("webhook_events")
            .update({
              processing_status: "processed",
              error_message: null,
              processed_at: new Date().toISOString(),
              processing_duration_ms: Date.now() - started,
              http_status: 200,
            })
            .eq("id", event.id);
          return Response.json({ ok: true, ...result });
        } catch (cause) {
          const message = formatProcessingError(cause);
          await db
            .from("webhook_events")
            .update({
              processing_status: "error",
              error_message: message,
              processed_at: new Date().toISOString(),
              processing_duration_ms: Date.now() - started,
              http_status: 500,
            })
            .eq("id", event.id);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
