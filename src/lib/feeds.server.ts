import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LEGACY_NOTION_EXPORT_GZIP_BASE64 } from "@/data/legacy-notion-export.base64";
import { extractPublicPage } from "@/lib/links.server";
import { processWithAI } from "@/lib/gemini/service.server";
import { enrichWithDuplicateWarning } from "@/lib/duplicates.server";

export type FeedSource = {
  id: string;
  name: string;
  url: string;
  trusted: boolean;
  autoPublish: boolean;
};

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

const LEGACY_NOTION_SOURCE: FeedSource = {
  id: "legacy-notion-agenda",
  name: "Agenda Cultural Inimigos do Fim — Notion",
  url: "https://tide-candy-1f5.notion.site/68ee129b62a5465197a1f0d7b47afcda?v=94c86de6ba024fac98c266b5c68bcbb8&source=copy_link",
  trusted: true,
  autoPublish: true,
};

const LEGACY_IMPORT_BATCH_SIZE = 10;

export const DEFAULT_FEED_SOURCES: FeedSource[] = [LEGACY_NOTION_SOURCE];

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

async function decodeLegacyNotionExport(): Promise<LegacyNotionRow[]> {
  // Usa somente Web APIs, compatíveis tanto com o runtime do Lovable/Cloudflare
  // quanto com runtimes Node modernos. Evita depender de node:zlib em produção.
  const binary = atob(LEGACY_NOTION_EXPORT_GZIP_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const json = await new Response(stream).text();
  const parsed = JSON.parse(json) as LegacyNotionRow[];
  if (!Array.isArray(parsed)) throw new Error("Exportação legada do Notion inválida.");
  return parsed;
}

async function upsertFeedRow(
  row: Record<string, unknown> & {
    title?: string | null;
    event_date?: string | null;
    location?: string | null;
    city?: string | null;
    source_url?: string | null;
    review_status?: string | null;
    warnings?: string[] | null;
    extracted_data?: unknown;
  },
  externalKey: string,
  autoPublish: boolean,
) {
  // Descobre o registro desta mesma fonte antes da análise de duplicidade. Assim,
  // uma ressincronização não compara o evento com ele próprio.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("interpreted_contents")
    .select("id")
    .contains("extracted_data", { feedExternalKey: externalKey })
    .maybeSingle();
  if (existingError) throw existingError;

  const checked = await enrichWithDuplicateWarning({
    ...row,
    ...(existing?.id ? { id: existing.id } : {}),
  });
  const duplicate = checked.review_status === "necessita_revisao";
  const now = new Date().toISOString();

  const finalRow = duplicate
    ? checked
    : autoPublish
      ? {
          ...checked,
          review_status: "publicado",
          reviewed_at: now,
        }
      : {
          ...checked,
          review_status: checked.review_status || "pendente",
          reviewed_at: null,
        };

  const extracted =
    finalRow.extracted_data && typeof finalRow.extracted_data === "object" && !Array.isArray(finalRow.extracted_data)
      ? (finalRow.extracted_data as Record<string, unknown>)
      : {};

  const { id: _ignoredId, ...rowWithoutId } = finalRow as typeof finalRow & { id?: string };
  const rowWithKey = {
    ...rowWithoutId,
    extracted_data: {
      ...extracted,
      feedExternalKey: externalKey,
    },
    updated_at: now,
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("interpreted_contents")
      .update(rowWithKey)
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, duplicate, status: rowWithKey.review_status || "pendente", updated: true };
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("interpreted_contents")
    .insert(rowWithKey)
    .select("id")
    .single();
  if (error) throw error;
  return { id: inserted.id, duplicate, status: rowWithKey.review_status || "pendente", updated: false };
}

function legacyRowPayload(item: LegacyNotionRow, eventSequence: number, importedAt: string) {
  const source = LEGACY_NOTION_SOURCE;
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
    source_url: item.source_url || source.url,
    missing_fields: [],
    warnings: [],
    confidence_score: 1,
    model_used: "notion-export:reviewed",
    prompt_version: "legacy-notion-export-1.0.0",
    review_status: "publicado",
    reviewed_at: importedAt,
    extracted_data: {
      sourceType: "notion_export",
      feedSourceId: source.id,
      feedSourceName: source.name,
      feedSourceUrl: source.url,
      trustedSource: true,
      autoPublish: true,
      importedAt,
      notionDatabaseId: "68ee129b62a5465197a1f0d7b47afcda",
      notionViewId: "94c86de6ba024fac98c266b5c68bcbb8",
      notionExportRow: item.notionExportRow,
      artistsResponsible: item.artists_responsible,
      classification: item.classification,
      rawDateTime: item.raw_datetime,
      eventEnd: item.event_end,
    },
  };
}

export async function ingestLegacyNotionExport() {
  const source = LEGACY_NOTION_SOURCE;
  const rows = await decodeLegacyNotionExport();
  const importedAt = new Date().toISOString();
  const results: Array<{
    title: string | null;
    id: string;
    status: string;
    duplicate: boolean;
    updated: boolean;
  }> = [];

  // Processa em lotes limitados: mantém a proteção de duplicidade, mas evita
  // centenas de chamadas sequenciais numa única requisição do painel.
  for (let start = 0; start < rows.length; start += LEGACY_IMPORT_BATCH_SIZE) {
    const batch = rows.slice(start, start + LEGACY_IMPORT_BATCH_SIZE);
    const savedBatch = await Promise.all(
      batch.map(async (item, offset) => {
        const eventSequence = start + offset;
        const row = legacyRowPayload(item, eventSequence, importedAt);
        const saved = await upsertFeedRow(row, item.source_key, true);
        return { title: item.title, ...saved };
      }),
    );
    results.push(...savedBatch);
  }

  return {
    source: source.name,
    total: rows.length,
    imported: results.filter((item) => !item.updated).length,
    updated: results.filter((item) => item.updated).length,
    published: results.filter((item) => item.status === "publicado").length,
    duplicates: results.filter((item) => item.duplicate).length,
    results,
  };
}

export async function ingestFeedSource(source: FeedSource) {
  const page = await extractPublicPage(source.url);
  const context = [
    `FONTE: ${source.name}`,
    `URL: ${source.url}`,
    page.title && `TÍTULO DA PÁGINA: ${page.title}`,
    page.description && `DESCRIÇÃO: ${page.description}`,
    page.text,
    "A página pode conter vários eventos. Extraia cada evento separadamente e não invente informações ausentes.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const interpreted = await processWithAI(context, []);
  const now = new Date().toISOString();
  const results: Array<{ title: string | null; status: string; duplicate: boolean }> = [];

  for (const [eventSequence, item] of interpreted.items.entries()) {
    const baseRow = {
      message_id: null,
      event_sequence: eventSequence,
      ...item,
      city: inferCity(item.city, item.location),
      price: item.price == null ? null : String(item.price),
      source_url: item.source_url || source.url,
      extracted_data: {
        sourceType: "feed",
        feedSourceId: source.id,
        feedSourceName: source.name,
        feedSourceUrl: source.url,
        trustedSource: source.trusted,
        importedAt: now,
      },
      model_used: `${interpreted.provider}:${interpreted.modelUsed}`,
      prompt_version: "feed-1.1.0",
      review_status: source.autoPublish && source.trusted ? "publicado" : "pendente",
      reviewed_at: source.autoPublish && source.trusted ? now : null,
      updated_at: now,
    };

    const sourceUrl = baseRow.source_url || source.url;
    const externalKey = [source.id, sourceUrl, baseRow.title || "", baseRow.event_date || ""]
      .join("|")
      .toLowerCase();
    const saved = await upsertFeedRow(
      baseRow,
      externalKey,
      source.trusted && source.autoPublish,
    );

    results.push({
      title: baseRow.title,
      status: saved.status,
      duplicate: saved.duplicate,
    });
  }

  return {
    source: source.name,
    imported: results.length,
    published: results.filter((item) => item.status === "publicado").length,
    duplicates: results.filter((item) => item.duplicate).length,
    results,
  };
}

export async function ingestDefaultFeeds() {
  const results = [];
  for (const source of DEFAULT_FEED_SOURCES) {
    try {
      results.push({ ok: true, ...(await ingestFeedSource(source)) });
    } catch (error) {
      results.push({
        ok: false,
        source: source.name,
        error: error instanceof Error ? error.message : "Falha ao importar feed",
      });
    }
  }
  return results;
}
