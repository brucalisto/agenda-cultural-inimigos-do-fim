export const EVIDENCE_FIELDS = [
  "title",
  "category",
  "summary",
  "full_description",
  "event_date",
  "location",
  "city",
  "price",
  "contact_name",
  "contact_phone",
  "contact_instagram",
  "source_url",
] as const;

export type EvidenceField = (typeof EVIDENCE_FIELDS)[number];

export const EVIDENCE_SOURCES = [
  "message_text",
  "caption",
  "image",
  "audio_transcript",
  "link_page",
  "metadata",
  "structured_source",
] as const;

export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export type FieldEvidence = {
  field: EvidenceField;
  source: EvidenceSource;
  source_ref: string;
  excerpt: string | null;
};

const fieldSet = new Set<string>(EVIDENCE_FIELDS);
const sourceSet = new Set<string>(EVIDENCE_SOURCES);

function compact(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeFieldEvidence(value: unknown): FieldEvidence[] {
  if (!Array.isArray(value)) return [];
  const output: FieldEvidence[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (typeof row.field !== "string" || !fieldSet.has(row.field)) continue;
    if (typeof row.source !== "string" || !sourceSet.has(row.source)) continue;
    const sourceRef = compact(row.source_ref, 100);
    if (!sourceRef) continue;
    const excerpt = compact(row.excerpt, 180);
    const key = `${row.field}|${row.source}|${sourceRef}|${excerpt || ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      field: row.field as EvidenceField,
      source: row.source as EvidenceSource,
      source_ref: sourceRef,
      excerpt,
    });
    if (output.length >= 16) break;
  }

  return output;
}

export function evidenceFromExtractedData(value: unknown) {
  const extracted = objectRecord(value);
  if (!extracted) return [];

  const direct = normalizeFieldEvidence(extracted.fieldEvidence);
  if (direct.length) return direct;

  // O fluxo do WhatsApp mantém o diagnóstico de qualidade dentro de
  // interpretationQuality para preservar toda a trilha do pacote consolidado.
  const quality = objectRecord(extracted.interpretationQuality);
  const qualityEvidence = objectRecord(quality?.evidence);
  return normalizeFieldEvidence(qualityEvidence?.fieldEvidence);
}

export function mergeFieldEvidence(...values: unknown[]) {
  return normalizeFieldEvidence(values.flatMap((value) => normalizeFieldEvidence(value)));
}
