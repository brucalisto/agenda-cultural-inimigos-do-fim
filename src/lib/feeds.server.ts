import { supabaseAdmin } from "@/integrations/supabase/client.server";
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

export const DEFAULT_FEED_SOURCES: FeedSource[] = [
  {
    id: "legacy-notion-agenda",
    name: "Agenda Cultural Inimigos do Fim — Notion",
    url: "https://tide-candy-1f5.notion.site/Agenda-Cultural-Inimigos-do-Fim-3c3623dd0eb881e4a8c6d9bd1c0f160b",
    trusted: true,
    autoPublish: true,
  },
];

function inferCity(city: string | null, location: string | null) {
  if (city?.trim()) return city.trim();
  if (!location?.trim() || /^(on-?line|virtual)$/i.test(location.trim())) return null;
  const parts = location.split(/\s*(?:,|—|–)\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts.at(-1)?.replace(/\s*-\s*[A-Z]{2}$/i, "").trim() || "";
  if (!/[A-Za-zÀ-ÿ]/.test(last) || /\d/.test(last) || last.length > 60) return null;
  return last;
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
  ].filter(Boolean).join("\n\n");

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
      prompt_version: "feed-1.0.0",
      review_status: source.autoPublish && source.trusted ? "publicado" : "pendente",
      reviewed_at: source.autoPublish && source.trusted ? now : null,
      updated_at: now,
    };

    const checked = await enrichWithDuplicateWarning(baseRow);
    const duplicate = checked.review_status === "necessita_revisao";

    // Fonte confiável pode publicar automaticamente, mas nunca ultrapassa uma sinalização de duplicidade.
    const finalRow = duplicate
      ? checked
      : {
          ...checked,
          review_status: source.autoPublish && source.trusted ? "publicado" : checked.review_status,
          reviewed_at: source.autoPublish && source.trusted ? now : null,
        };

    const sourceUrl = finalRow.source_url || source.url;
    const externalKeyParts = [source.id, sourceUrl, finalRow.title || "", finalRow.event_date || ""];
    const externalKey = externalKeyParts.join("|").toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("interpreted_contents")
      .select("id")
      .contains("extracted_data", { feedExternalKey: externalKey })
      .maybeSingle();

    const rowWithKey = {
      ...finalRow,
      extracted_data: {
        ...(finalRow.extracted_data as Record<string, unknown>),
        feedExternalKey: externalKey,
      },
    };

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("interpreted_contents")
        .update(rowWithKey)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("interpreted_contents").insert(rowWithKey);
      if (error) throw error;
    }

    results.push({
      title: finalRow.title,
      status: finalRow.review_status || "pendente",
      duplicate,
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
