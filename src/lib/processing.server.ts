import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { BaileysWebhookSchema, type BaileysWebhook } from "@/lib/adapters/baileys.server";
import { areMessagesComplementary, processWithAI } from "@/lib/gemini/service.server";
import { extractPublicPage, loadPublicImage } from "@/lib/links.server";

async function loadMedia(media: NonNullable<BaileysWebhook["media"]>) {
  const base = process.env["BAILEYS_API_URL"]?.replace(/\/$/, "");
  const key = process.env["BAILEYS_API_KEY"];
  if (!base || !key) throw new Error("Baileys não configurado.");
  if (media.size > 20 * 1024 * 1024) throw new Error("Mídia maior que 20 MB; exige revisão.");
  const path = media.relativePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${base}/media/${path}`, { headers: { "x-api-key": key } });
  if (!response.ok) throw new Error(`Mídia indisponível (${response.status}).`);
  return {
    mimeType: media.mimeType,
    data: Buffer.from(await response.arrayBuffer()).toString("base64"),
  };
}

function describeForGrouping(payload: BaileysWebhook) {
  return [
    `Tipo: ${payload.contentType}`,
    payload.text && `Texto: ${payload.text}`,
    payload.caption && `Legenda: ${payload.caption}`,
    payload.links.length && `Links: ${payload.links.join(", ")}`,
    payload.media && `Mídia: ${payload.media.mimeType}`,
    payload.linkPreview?.title && `Prévia: ${payload.linkPreview.title}`,
    payload.linkPreview?.description && `Descrição da prévia: ${payload.linkPreview.description}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function hasMedia(payload: BaileysWebhook) {
  return Boolean(payload.media || payload.linkPreview?.jpegThumbnailBase64);
}

function hasUsefulText(payload: BaileysWebhook) {
  return Boolean(payload.text?.trim() || payload.caption?.trim() || payload.links.length);
}

function isDeterministicComplement(previous: BaileysWebhook, current: BaileysWebhook) {
  return (
    (hasMedia(previous) && hasUsefulText(current)) || (hasMedia(current) && hasUsefulText(previous))
  );
}

function inferCity(city: string | null, location: string | null) {
  if (city?.trim()) return city.trim();
  if (!location?.trim() || /^(on-?line|virtual)$/i.test(location.trim())) return null;

  const parts = location
    .split(/\s*(?:,|—|–)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const last =
    parts
      .at(-1)
      ?.replace(/\s*-\s*[A-Z]{2}$/i, "")
      .trim() || "";
  if (!/[A-Za-zÀ-ÿ]/.test(last) || /\d/.test(last) || last.length > 60) return null;
  return last;
}

export async function processBaileysMessage(payload: BaileysWebhook, groupId: string) {
  const db = supabaseAdmin;
  const timestamp = Number(payload.messageTimestamp);
  const occurred = Number.isFinite(timestamp)
    ? new Date(timestamp * (String(payload.messageTimestamp).length <= 10 ? 1000 : 1)).toISOString()
    : new Date(payload.receivedAt).toISOString();

  const { data: message, error } = await db
    .from("whatsapp_messages")
    .upsert(
      {
        external_message_id: payload.messageId,
        group_id: groupId,
        sender_external_id: payload.senderId,
        sender_name: payload.senderName ?? null,
        message_type: payload.contentType,
        text_content: payload.text ?? null,
        caption: payload.caption ?? null,
        occurred_at: occurred,
        received_at: payload.receivedAt,
        raw_payload: payload as unknown as Json,
        processing_status: "processando",
        error_message: null,
      },
      { onConflict: "external_message_id" },
    )
    .select()
    .single();

  if (error) throw error;

  try {
    const cutoff = new Date(new Date(occurred).getTime() - 5 * 60_000).toISOString();
    const { data: previous } = await db
      .from("whatsapp_messages")
      .select("id, raw_payload")
      .eq("group_id", groupId)
      .eq("sender_external_id", payload.senderId)
      .neq("id", message.id)
      .is("bundled_into_message_id", null)
      .in("processing_status", ["processando", "interpretado", "necessita_revisao", "pendente"])
      .gte("occurred_at", cutoff)
      .lte("occurred_at", occurred)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let payloads = [payload];
    let bundledMessageId: string | null = null;
    if (previous?.raw_payload) {
      const parsed = BaileysWebhookSchema.safeParse(previous.raw_payload);
      if (parsed.success) {
        const complementary =
          isDeterministicComplement(parsed.data, payload) ||
          (await areMessagesComplementary(
            describeForGrouping(parsed.data),
            describeForGrouping(payload),
          ));
        if (complementary) {
          payloads = [parsed.data, payload];
          bundledMessageId = previous.id;
          await db.from("interpreted_contents").delete().eq("message_id", previous.id);
          await db
            .from("whatsapp_messages")
            .update({
              processing_status: "ignorado",
              bundled_into_message_id: message.id,
              error_message: "Agrupada a uma mensagem complementar enviada em seguida",
            })
            .eq("id", previous.id);
        }
      }
    }

    await db.from("extracted_links").delete().eq("message_id", message.id);
    await db.from("message_media").delete().eq("message_id", message.id);

    const contexts: string[] = [];
    const mediaFiles: Array<{ mimeType: string; data: string }> = [];
    const extraWarnings: string[] = [];
    const loadedRemoteImages = new Set<string>();
    for (const [index, item] of payloads.entries()) {
      contexts.push(
        `MENSAGEM ${index + 1}\n${[item.text, item.caption].filter(Boolean).join("\n")}`,
      );
      if (item.linkPreview?.title || item.linkPreview?.description) {
        contexts.push(
          `PRÉVIA DO LINK NO WHATSAPP\n${item.linkPreview.title || ""}\n${item.linkPreview.description || ""}`,
        );
      }
      for (const url of item.links.slice(0, 3)) {
        try {
          const page = await extractPublicPage(url);
          contexts.push(
            `LINK ${url}\n${page.title || ""}\n${page.description || ""}\n${page.text}`,
          );
          if (page.imageUrl && !loadedRemoteImages.has(page.imageUrl)) {
            try {
              mediaFiles.push(await loadPublicImage(page.imageUrl));
              loadedRemoteImages.add(page.imageUrl);
            } catch (cause) {
              extraWarnings.push(
                cause instanceof Error ? cause.message : "Imagem do link indisponível",
              );
            }
          }
          await db.from("extracted_links").insert({
            message_id: message.id,
            original_url: url,
            normalized_url: url,
            page_title: page.title,
            page_description: page.description,
            extracted_text: page.text,
            extraction_status: "extraido",
          });
        } catch (cause) {
          await db.from("extracted_links").insert({
            message_id: message.id,
            original_url: url,
            normalized_url: url,
            extraction_status: "erro",
            failure_reason: cause instanceof Error ? cause.message : "Falha",
          });
        }
      }
      if (item.linkPreview?.jpegThumbnailBase64) {
        mediaFiles.push({ mimeType: "image/jpeg", data: item.linkPreview.jpegThumbnailBase64 });
      }
      if (item.media) {
        await db.from("message_media").insert({
          message_id: message.id,
          media_type: item.contentType,
          original_filename: item.media.fileName,
          mime_type: item.media.mimeType,
          file_size: item.media.size,
          storage_path: item.media.relativePath,
        });
        try {
          mediaFiles.push(await loadMedia(item.media));
        } catch (cause) {
          extraWarnings.push(cause instanceof Error ? cause.message : "Mídia indisponível");
        }
      }
    }

    const context = contexts.filter(Boolean).join("\n\n");
    if (!context && !mediaFiles.length) {
      await db
        .from("whatsapp_messages")
        .update({ processing_status: "ignorado", error_message: "Sem conteúdo interpretável" })
        .eq("id", message.id);
      return { ignored: true };
    }

    const interpreted = await processWithAI(context || "Analise a mídia anexada.", mediaFiles);
    const rows = interpreted.items.map((item, eventSequence) => {
      const reviewStatus =
        item.confidence_score >= 0.75 && item.missing_fields.length === 0
          ? "pendente"
          : "necessita_revisao";
      return {
        message_id: message.id,
        event_sequence: eventSequence,
        ...item,
        city: inferCity(item.city, item.location),
        price: item.price == null ? null : String(item.price),
        warnings: [...item.warnings, ...extraWarnings],
        extracted_data: {
          groupId: payload.groupId,
          groupName: payload.groupName,
          bundledMessageId,
          eventSequence,
          eventCount: interpreted.items.length,
          messages: payloads.map((source) => ({
            messageId: source.messageId,
            contentType: source.contentType,
            text: source.text ?? null,
            caption: source.caption ?? null,
            receivedAt: source.receivedAt,
            links: source.links,
            media: source.media,
          })),
        },
        model_used: `${interpreted.provider}:${interpreted.modelUsed}`,
        prompt_version: "1.5.0",
        review_status: reviewStatus,
        updated_at: new Date().toISOString(),
      };
    });

    await db.from("interpreted_contents").delete().eq("message_id", message.id);
    const { error: interpretError } = await db.from("interpreted_contents").insert(rows);
    if (interpretError) throw interpretError;

    const requiresReview = rows.some((row) => row.review_status === "necessita_revisao");

    await db
      .from("whatsapp_messages")
      .update({
        processing_status: requiresReview ? "necessita_revisao" : "interpretado",
        error_message: null,
      })
      .eq("id", message.id);
    return {
      ignored: false,
      reviewStatus: requiresReview ? "necessita_revisao" : "pendente",
      interpretedCount: rows.length,
    };
  } catch (cause) {
    const errorMessage = cause instanceof Error ? cause.message : "Falha no processamento";
    await db
      .from("whatsapp_messages")
      .update({ processing_status: "erro", error_message: errorMessage })
      .eq("id", message.id);
    throw cause;
  }
}
