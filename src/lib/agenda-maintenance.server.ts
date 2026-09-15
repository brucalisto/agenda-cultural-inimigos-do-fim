import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { geocodePublishedEvents } from "@/lib/event-geocoding.server";
import { needsEventImagePersistence, persistEventImage } from "@/lib/event-images.server";

const IMAGE_REPAIR_SCAN_LIMIT = 300;
const IMAGE_REPAIR_BATCH_LIMIT = 20;

type ImageRepairFailure = {
  id: string;
  title: string | null;
  error: string;
};

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stableImageKey(row: {
  id: string;
  source_url: string | null;
  extracted_data: unknown;
}) {
  const extracted = jsonObject(row.extracted_data);
  const sourceType = typeof extracted?.sourceType === "string" ? extracted.sourceType : "event";
  const externalId =
    (typeof extracted?.instagramShortcode === "string" && extracted.instagramShortcode) ||
    (typeof extracted?.feedExternalKey === "string" && extracted.feedExternalKey) ||
    row.id;

  return {
    source: sourceType,
    externalId,
  };
}

export async function repairUnstableEventImages(limit = IMAGE_REPAIR_BATCH_LIMIT) {
  const safeLimit = Math.max(1, Math.min(limit, IMAGE_REPAIR_BATCH_LIMIT));
  const { data, error } = await supabaseAdmin
    .from("interpreted_contents")
    .select("id,title,image_url,source_url,extracted_data,review_status,updated_at")
    .not("image_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(IMAGE_REPAIR_SCAN_LIMIT);

  if (error) throw new Error(`Falha ao localizar imagens instáveis: ${error.message}`);

  const candidates = (data ?? [])
    .filter((row) => row.review_status !== "ignorado" && row.review_status !== "desativado")
    .filter((row) => needsEventImagePersistence(row.image_url))
    .slice(0, safeLimit);

  let repaired = 0;
  const failures: ImageRepairFailure[] = [];

  for (const row of candidates) {
    try {
      const imageUrl = await persistEventImage(row.image_url, stableImageKey(row));
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
        error: cause instanceof Error ? cause.message.slice(0, 300) : "Falha desconhecida ao persistir imagem.",
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

export async function runSafeAgendaMaintenance() {
  const startedAt = new Date().toISOString();
  const results: {
    geocoding: Awaited<ReturnType<typeof geocodePublishedEvents>> | null;
    images: Awaited<ReturnType<typeof repairUnstableEventImages>> | null;
    warnings: string[];
  } = {
    geocoding: null,
    images: null,
    warnings: [],
  };

  try {
    results.geocoding = await geocodePublishedEvents();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha desconhecida na geocodificação.";
    results.warnings.push(`Geocodificação: ${message}`);
    console.warn("[agenda-maintenance] Geocodificação falhou:", cause);
  }

  try {
    results.images = await repairUnstableEventImages();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha desconhecida na persistência de imagens.";
    results.warnings.push(`Imagens: ${message}`);
    console.warn("[agenda-maintenance] Persistência de imagens falhou:", cause);
  }

  return {
    ok: results.warnings.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...results,
  };
}
