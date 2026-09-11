import { LEGACY_NOTION_EXPORT_GZIP_BASE64 } from "@/data/legacy-notion-export.base64";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enrichWithDuplicateWarning } from "@/lib/duplicates.server";
import { requireAdminAccess } from "@/lib/feed-sources.server";

type LegacyNotionRow = {
  notionExportRow: number;
  title: string | null;
  category: string | null;
  summary: string | null;
  full_description: string | null;
  event_date: string | null;
  location: string | null;
  city: string | null;
  price: string | null;
  source_url: string | null;
  artists_responsible: string | null;
  classification: string | null;
  raw_datetime: string | null;
  event_end: string | null;
  source_key: string;
};

type ImportHistoryEntry = {
  processedAt: string;
  loadVersion: string;
  loadTotal: number;
  imported: number;
  updated: number;
  published: number;
  duplicates: number;
  status: "sucesso" | "erro";
  error?: string;
};

const LEGACY_SOURCE_ID = "legacy-notion-agenda";
const LEGACY_SOURCE_NAME = "Agenda Cultural Inimigos do Fim — Notion";
const LEGACY_SOURCE_URL =
  "https://tide-candy-1f5.notion.site/68ee129b62a5465197a1f0d7b47afcda?v=94c86de6ba024fac98c266b5c68bcbb8&source=copy_link";
const CURRENT_LOAD_START = "2026-09-11";
const CURRENT_LOAD_VERSION = "notion-upcoming-2026-09-11";
const BATCH_SIZE = 10;

function inferCity(city: string | null, location: string | null) {
  if (city?.trim()) return city.trim();
  if (!location?.trim() || /^(on-?line|virtual)$/i.test(location.trim())) return null;
  const parts = location
    .split(/\s*(?:,|—|–)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts.at(-1)?.replace(/\s*-\s*[A-Z]{2}$/i, "").trim() || "";
  if (!/[A-Za-zÀ-ÿ]/.test(last) || /\d/.test(last) || last.length > 60) return null;
  return last;
}

function datePart(value: string | null) {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || null;
}

function belongsToCurrentLoad(row: LegacyNotionRow) {
  const start = datePart(row.event_date);
  const end = datePart(row.event_end);
  if (end && end >= CURRENT_LOAD_START) return true;
  return Boolean(start && start >= CURRENT_LOAD_START);
}

async function decodeRows() {
  const binary = atob(LEGACY_NOTION_EXPORT_GZIP_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const parsed = JSON.parse(await new Response(stream).text()) as LegacyNotionRow[];
  if (!Array.isArray(parsed)) throw new Error("Exportação do Notion inválida.");
  return parsed;
}

async function currentRows() {
  return (await decodeRows()).filter(belongsToCurrentLoad);
}

function payload(item: LegacyNotionRow, eventSequence: number, importedAt: string) {
  return {
    message_id: null,
    event_sequence: eventSequence,
    title: item.title,
    category: item.category,
    summary: item.summary,
    full_description: item.full_description,
    event_date: item.event_date,
    location: item.location,
    city: inferCity(item.city, item.location),
    price: item.price,
    source_url: item.source_url || LEGACY_SOURCE_URL,
    missing_fields: [],
    warnings: [],
    confidence_score: 1,
    model_used: "notion-export:reviewed",
    prompt_version: "legacy-notion-current-2.0.0",
    review_status: "publicado",
    reviewed_at: importedAt,
    extracted_data: {
      sourceType: "notion_export",
      feedSourceId: LEGACY_SOURCE_ID,
      feedSourceName: LEGACY_SOURCE_NAME,
      feedSourceUrl: LEGACY_SOURCE_URL,
      trustedSource: true,
      autoPublish: true,
      importedAt,
      loadVersion: CURRENT_LOAD_VERSION,
      notionExportRow: item.notionExportRow,
      artistsResponsible: item.artists_responsible,
      classification: item.classification,
      rawDateTime: item.raw_datetime,
      eventEnd: item.event_end,
    },
  };
}

async function upsert(item: LegacyNotionRow, eventSequence: number, importedAt: string) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("interpreted_contents")
    .select("id")
    .contains("extracted_data", { feedExternalKey: item.source_key })
    .maybeSingle();
  if (existingError) throw existingError;

  const base = payload(item, eventSequence, importedAt);
  const checked = await enrichWithDuplicateWarning({
    ...base,
    ...(existing?.id ? { id: existing.id } : {}),
  });
  const duplicate = checked.review_status === "necessita_revisao";
  const finalRow = duplicate
    ? { ...checked, reviewed_at: null }
    : { ...checked, review_status: "publicado", reviewed_at: importedAt };
  const extracted =
    finalRow.extracted_data && typeof finalRow.extracted_data === "object" && !Array.isArray(finalRow.extracted_data)
      ? (finalRow.extracted_data as Record<string, unknown>)
      : {};
  const { id: _ignoredId, ...withoutId } = finalRow as typeof finalRow & { id?: string };
  const row = {
    ...withoutId,
    extracted_data: { ...extracted, feedExternalKey: item.source_key },
    updated_at: importedAt,
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin.from("interpreted_contents").update(row).eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, duplicate, status: row.review_status || "pendente", updated: true };
  }

  const { data, error } = await supabaseAdmin.from("interpreted_contents").insert(row as never).select("id").single();
  if (error) throw error;
  return { id: data.id, duplicate, status: row.review_status || "pendente", updated: false };
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function historyFrom(value: unknown): ImportHistoryEntry[] {
  const candidate = asObject(value).importHistory;
  return Array.isArray(candidate) ? (candidate as ImportHistoryEntry[]) : [];
}

async function saveHistory(entry: ImportHistoryEntry) {
  const { data, error } = await supabaseAdmin
    .from("publication_destinations")
    .select("id,field_mapping")
    .eq("provider", "feed_source")
    .eq("endpoint_url", LEGACY_SOURCE_URL)
    .maybeSingle();
  if (error || !data) return;
  const meta = asObject(data.field_mapping);
  const history = [entry, ...historyFrom(meta)].slice(0, 20);
  await supabaseAdmin
    .from("publication_destinations")
    .update({
      field_mapping: {
        ...meta,
        sourceType: "notion",
        trusted: true,
        autoPublish: true,
        lastSyncedAt: entry.processedAt,
        lastSyncStatus: entry.status,
        lastSyncResult: entry.status === "sucesso" ? entry : { error: entry.error || "Falha na importação" },
        importHistory: history,
        loadVersion: CURRENT_LOAD_VERSION,
        loadTotal: entry.loadTotal,
      },
      updated_at: entry.processedAt,
    })
    .eq("id", data.id);
}

export async function ingestCurrentNotionExport() {
  const rows = await currentRows();
  const processedAt = new Date().toISOString();
  const results: Array<{ id: string; duplicate: boolean; status: string; updated: boolean }> = [];

  try {
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE);
      const saved = await Promise.all(
        batch.map((item, offset) => upsert(item, start + offset, processedAt)),
      );
      results.push(...saved);
    }

    const summary = {
      source: LEGACY_SOURCE_NAME,
      loadVersion: CURRENT_LOAD_VERSION,
      total: rows.length,
      imported: results.filter((item) => !item.updated).length,
      updated: results.filter((item) => item.updated).length,
      published: results.filter((item) => item.status === "publicado").length,
      duplicates: results.filter((item) => item.duplicate).length,
      processedAt,
    };
    await saveHistory({
      processedAt,
      loadVersion: CURRENT_LOAD_VERSION,
      loadTotal: rows.length,
      imported: summary.imported,
      updated: summary.updated,
      published: summary.published,
      duplicates: summary.duplicates,
      status: "sucesso",
    });
    return summary;
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Falha ao processar a carga do Notion.";
    await saveHistory({
      processedAt,
      loadVersion: CURRENT_LOAD_VERSION,
      loadTotal: rows.length,
      imported: results.filter((item) => !item.updated).length,
      updated: results.filter((item) => item.updated).length,
      published: results.filter((item) => item.status === "publicado").length,
      duplicates: results.filter((item) => item.duplicate).length,
      status: "erro",
      error,
    });
    throw new Error(error);
  }
}

export async function getCurrentNotionStatus(accessToken: string) {
  await requireAdminAccess(accessToken);
  const rows = await currentRows();
  const keys = new Set(rows.map((row) => row.source_key));

  const { data, error } = await supabaseAdmin
    .from("interpreted_contents")
    .select("id,review_status,extracted_data")
    .contains("extracted_data", { feedSourceId: LEGACY_SOURCE_ID });
  if (error) throw error;

  const active = (data || []).filter((row) => {
    const externalKey = asObject(row.extracted_data).feedExternalKey;
    return typeof externalKey === "string" && keys.has(externalKey);
  });

  const { data: source } = await supabaseAdmin
    .from("publication_destinations")
    .select("field_mapping")
    .eq("provider", "feed_source")
    .eq("endpoint_url", LEGACY_SOURCE_URL)
    .maybeSingle();
  const meta = asObject(source?.field_mapping);

  return {
    available: rows.length,
    total: active.length,
    published: active.filter((row) => row.review_status === "publicado").length,
    review: active.filter((row) => row.review_status === "necessita_revisao").length,
    loadVersion: CURRENT_LOAD_VERSION,
    loadStart: CURRENT_LOAD_START,
    lastProcessedAt: typeof meta.lastSyncedAt === "string" ? meta.lastSyncedAt : null,
    lastStatus: typeof meta.lastSyncStatus === "string" ? meta.lastSyncStatus : null,
    history: historyFrom(meta),
    historicalTotal: (data || []).length,
  };
}
