import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPublicImage } from "@/lib/links.server";

const EVENT_IMAGES_BUCKET = "event-images";
const EVENT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_REPAIR_SCAN_LIMIT = 300;
const IMAGE_REPAIR_BATCH_LIMIT = 20;
const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function safeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "media";
}

function isOwnEventImageUrl(value: string | null | undefined) {
  if (!value) return false;
  return value.includes(`/storage/v1/object/public/${EVENT_IMAGES_BUCKET}/`);
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Copia uma imagem remota para o bucket público da agenda.
 * URLs de CDN do Instagram expiram; a agenda pública nunca deve depender delas
 * depois que a publicação já foi ingerida.
 */
export async function persistEventImage(
  remoteUrl: string | null | undefined,
  key: { source: string; externalId: string; role?: string },
) {
  if (!remoteUrl) return null;
  if (isOwnEventImageUrl(remoteUrl)) return remoteUrl;

  const image = await loadPublicImage(remoteUrl);
  const extension = MIME_EXTENSION[image.mimeType];
  if (!extension) {
    throw new Error(`Formato de imagem não suportado para persistência: ${image.mimeType || "desconhecido"}.`);
  }

  const path = [
    safeSegment(key.source),
    safeSegment(key.externalId),
    `${safeSegment(key.role || "cover")}.${extension}`,
  ].join("/");
  const buffer = Buffer.from(image.data, "base64");
  if (buffer.length > EVENT_IMAGE_MAX_BYTES) {
    throw new Error("Imagem remota excede o limite de 8 MB para capas de eventos.");
  }

  const { error } = await supabaseAdmin.storage.from(EVENT_IMAGES_BUCKET).upload(path, buffer, {
    contentType: image.mimeType,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(EVENT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

export function needsEventImagePersistence(value: string | null | undefined) {
  return Boolean(value && !isOwnEventImageUrl(value));
}

export async function repairUnstableEventImages(limit = IMAGE_REPAIR_BATCH_LIMIT) {
  const safeLimit = Math.max(1, Math.min(limit, IMAGE_REPAIR_BATCH_LIMIT));
  const { data, error } = await supabaseAdmin
    .from("interpreted_contents")
    .select("id,title,image_url,extracted_data,review_status,updated_at")
    .not("image_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(IMAGE_REPAIR_SCAN_LIMIT);

  if (error) throw new Error(`Falha ao localizar imagens instáveis: ${error.message}`);

  const candidates = (data ?? [])
    .filter((row) => row.review_status !== "ignorado" && row.review_status !== "desativado")
    .filter((row) => needsEventImagePersistence(row.image_url))
    .slice(0, safeLimit);

  const failures: Array<{ id: string; title: string | null; reason: string }> = [];
  let repaired = 0;

  for (const row of candidates) {
    try {
      const extracted = jsonObject(row.extracted_data);
      const source = typeof extracted?.sourceType === "string" ? extracted.sourceType : "event";
      const externalId =
        (typeof extracted?.instagramShortcode === "string" && extracted.instagramShortcode) ||
        (typeof extracted?.feedExternalKey === "string" && extracted.feedExternalKey) ||
        row.id;
      const imageUrl = await persistEventImage(row.image_url, { source, externalId });
      if (!imageUrl || imageUrl === row.image_url) continue;

      const { error: updateError } = await supabaseAdmin
        .from("interpreted_contents")
        .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (updateError) throw updateError;
      repaired += 1;
    } catch (cause) {
      failures.push({
        id: row.id,
        title: row.title,
        reason: cause instanceof Error ? cause.message.slice(0, 300) : "Falha desconhecida.",
      });
    }
  }

  return {
    scanned: data?.length ?? 0,
    candidates: candidates.length,
    repaired,
    failed: failures.length,
    failures,
  };
}
