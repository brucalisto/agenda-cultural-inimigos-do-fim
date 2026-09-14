import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPublicImage } from "@/lib/links.server";

const EVENT_IMAGES_BUCKET = "event-images";
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
