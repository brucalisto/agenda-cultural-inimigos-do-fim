import type { BaileysWebhook } from "@/lib/adapters/baileys.server";
import type { InterpretedContentResponse } from "@/lib/gemini/schema";

const ALLOWED_CATEGORIES = new Map([
  ["evento", "Evento"],
  ["noticia", "Notícia"],
  ["promocao", "Promoção"],
  ["aviso", "Aviso"],
  ["outro", "Outro"],
]);

const CORRECTION_PATTERN =
  /\b(corrigindo|corre[cç][aã]o|retificando|retifica[cç][aã]o|mudou para|alterad[oa] para|na verdade|hor[aá]rio correto|data correta|endere[cç]o correto|atualiza[cç][aã]o)\b/i;
const SEVERE_WARNING_PATTERN = /\b(conflit|amb[ií]gu|inv[aá]lid|contradit|ileg[ií]vel|incert)\w*/i;
const ONLINE_LOCATION_PATTERN = /^(on-?line|virtual|internet|remoto)$/i;

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function clean(value: string | null | undefined, maxLength: number) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function unique(values: Array<string | null | undefined>, max = 6) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = normalizeSearch(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= max) break;
  }
  return result;
}

function normalizeCategory(category: string | null) {
  if (!category) return { value: null, changed: false };
  const value = ALLOWED_CATEGORIES.get(normalizeSearch(category));
  if (value) return { value, changed: value !== category };
  return { value: "Outro", changed: true };
}

function normalizePhone(phone: string | null) {
  if (!phone) return null;
  const hasPlus = phone.trim().startsWith("+");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return clean(phone, 40);
  return `${hasPlus ? "+" : ""}${digits}`;
}

function normalizeInstagram(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  const urlMatch = trimmed.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const handle = urlMatch?.[1] || trimmed.replace(/^@/, "").split(/[/?#\s]/)[0];
  if (!handle || !/^[A-Za-z0-9._]{1,30}$/.test(handle)) return clean(value, 120);
  return `@${handle}`;
}

function normalizeEventDate(value: string | null) {
  if (!value) return { value: null, invalid: false };
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return { value: null, invalid: true };
  return { value, invalid: false };
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function isLikelyCorrectionOrContinuation(payload: BaileysWebhook) {
  const text = [payload.text, payload.caption].filter(Boolean).join(" ");
  return CORRECTION_PATTERN.test(text);
}

export function formatWhatsAppContext(payload: BaileysWebhook, index: number) {
  return [
    `MENSAGEM ${index + 1} (ordem cronológica)`,
    `Recebida em: ${payload.receivedAt}`,
    `Tipo: ${payload.contentType}`,
    payload.senderName && `Remetente: ${payload.senderName}`,
    payload.text && `Texto: ${payload.text}`,
    payload.caption && `Legenda: ${payload.caption}`,
    payload.links.length && `Links: ${payload.links.join(", ")}`,
    payload.linkPreview?.title && `Título da prévia: ${payload.linkPreview.title}`,
    payload.linkPreview?.description && `Descrição da prévia: ${payload.linkPreview.description}`,
    payload.media &&
      `Mídia anexada: ${payload.media.mimeType}${payload.media.fileName ? ` (${payload.media.fileName})` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type InterpretationQuality = {
  sourceType: "whatsapp";
  sourceReliability: "unstructured";
  originalConfidence: number;
  adjustedConfidence: number;
  reviewRecommended: boolean;
  criticalMissingFields: string[];
  validationWarnings: string[];
  correctionOrUpdateDetected: boolean;
  evidence: {
    messageCount: number;
    hasText: boolean;
    hasMedia: boolean;
    hasLinks: boolean;
  };
};

export function assessInterpretationQuality(
  input: InterpretedContentResponse,
  payloads: BaileysWebhook[],
) {
  const missing = unique(input.missing_fields || [], 12);
  const validationWarnings: string[] = [];
  const category = normalizeCategory(input.category);
  if (category.changed && input.category) {
    validationWarnings.push(`Categoria "${input.category}" normalizada para ${category.value}.`);
  }
  if (!category.value) missing.push("category");

  const date = normalizeEventDate(input.event_date);
  if (date.invalid) {
    validationWarnings.push("Data retornada pela IA era inválida e foi removida.");
    missing.push("event_date");
  }

  let price = input.price;
  if (price != null && (!Number.isFinite(price) || price < 0)) {
    price = null;
    validationWarnings.push("Preço inválido retornado pela IA e removido.");
  }

  const allowedSourceUrls = new Set(payloads.flatMap((payload) => payload.links));
  let sourceUrl = clean(input.source_url, 500);
  if (sourceUrl && !allowedSourceUrls.has(sourceUrl)) {
    sourceUrl = null;
    validationWarnings.push("URL de origem sem evidência no pacote recebido foi removida.");
  }

  const normalized: InterpretedContentResponse = {
    ...input,
    title: clean(input.title, 120),
    category: category.value,
    summary: clean(input.summary, 180),
    full_description: clean(input.full_description, 450),
    event_date: date.value,
    location: clean(input.location, 240),
    city: clean(input.city, 100),
    price,
    contact_name: clean(input.contact_name, 120),
    contact_phone: normalizePhone(input.contact_phone),
    contact_instagram: normalizeInstagram(input.contact_instagram),
    source_url: sourceUrl,
    keywords: unique(input.keywords || [], 6),
    missing_fields: [],
    warnings: [],
    confidence_score: clamp(input.confidence_score),
  };

  const isEvent = normalized.category === "Evento";
  const criticalMissingFields: string[] = [];
  if (isEvent) {
    if (!normalized.title) criticalMissingFields.push("title");
    if (!normalized.event_date) criticalMissingFields.push("event_date");
    if (!normalized.location) criticalMissingFields.push("location");
  }

  if (
    isEvent &&
    normalized.location &&
    !ONLINE_LOCATION_PATTERN.test(normalized.location) &&
    !normalized.city
  ) {
    missing.push("city");
  }

  for (const field of criticalMissingFields) missing.push(field);

  const correctionOrUpdateDetected = payloads.some(isLikelyCorrectionOrContinuation);
  const warnings = unique([...(input.warnings || []), ...validationWarnings], 6);
  const severeWarning = warnings.some((warning) => SEVERE_WARNING_PATTERN.test(warning));

  let adjustedConfidence = clamp(input.confidence_score);
  if (!normalized.category) adjustedConfidence -= 0.08;
  if (isEvent && !normalized.title) adjustedConfidence -= 0.22;
  if (isEvent && !normalized.event_date) adjustedConfidence -= 0.22;
  if (isEvent && !normalized.location) adjustedConfidence -= 0.14;
  if (category.changed && input.category) adjustedConfidence -= 0.04;
  if (date.invalid) adjustedConfidence -= 0.12;
  if (severeWarning) adjustedConfidence -= 0.1;
  adjustedConfidence -= Math.min(0.08, Math.max(0, missing.length - criticalMissingFields.length) * 0.02);
  adjustedConfidence = clamp(adjustedConfidence);

  if (criticalMissingFields.length) adjustedConfidence = Math.min(adjustedConfidence, 0.69);
  if (severeWarning) adjustedConfidence = Math.min(adjustedConfidence, 0.74);
  if (missing.length && adjustedConfidence > 0.84) adjustedConfidence = 0.84;
  adjustedConfidence = Number(adjustedConfidence.toFixed(2));

  normalized.missing_fields = unique(missing, 6);
  normalized.warnings = unique(warnings, 4);
  normalized.confidence_score = adjustedConfidence;

  const quality: InterpretationQuality = {
    sourceType: "whatsapp",
    sourceReliability: "unstructured",
    originalConfidence: Number(clamp(input.confidence_score).toFixed(2)),
    adjustedConfidence,
    reviewRecommended:
      adjustedConfidence < 0.78 ||
      !normalized.category ||
      criticalMissingFields.length > 0 ||
      severeWarning ||
      date.invalid,
    criticalMissingFields: unique(criticalMissingFields, 6),
    validationWarnings: unique(validationWarnings, 6),
    correctionOrUpdateDetected,
    evidence: {
      messageCount: payloads.length,
      hasText: payloads.some((payload) => Boolean(payload.text?.trim() || payload.caption?.trim())),
      hasMedia: payloads.some((payload) =>
        Boolean(payload.media || payload.linkPreview?.jpegThumbnailBase64),
      ),
      hasLinks: payloads.some((payload) => payload.links.length > 0),
    },
  };

  return { item: normalized, quality };
}
