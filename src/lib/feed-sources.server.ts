import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ingestFeedSource, type FeedSource } from "@/lib/feeds.server";

type FeedMetadata = {
  sourceType?: string;
  trusted?: boolean;
  autoPublish?: boolean;
  lastSyncedAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncResult?: unknown;
};

type PublicationDestinationRow = {
  id: string;
  nome: string;
  endpoint_url: string | null;
  provider: string | null;
  enabled: boolean | null;
  field_mapping: unknown;
  created_at: string | null;
  updated_at: string | null;
};

export type FeedSourceRecord = {
  id: string;
  name: string;
  url: string;
  source_type: string;
  active: boolean;
  trusted: boolean;
  auto_publish: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_result: unknown;
  created_at: string;
  updated_at: string;
};

const NOTION_URL =
  "https://tide-candy-1f5.notion.site/68ee129b62a5465197a1f0d7b47afcda?v=94c86de6ba024fac98c266b5c68bcbb8&source=copy_link";
const FEED_PROVIDER = "feed_source";

function metadata(value: unknown): FeedMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as FeedMetadata;
}

function sourceType(url: string) {
  if (/(?:notion\.site|notion\.com)/i.test(url)) return "notion";
  if (/(?:instagram\.com)/i.test(url)) return "instagram";
  if (/(?:\/rss\b|\/feed\b|\.xml(?:\?|$))/i.test(url)) return "rss";
  return "web";
}

function normalizeSource(row: PublicationDestinationRow): FeedSourceRecord {
  const meta = metadata(row.field_mapping);
  return {
    id: row.id,
    name: row.nome,
    url: row.endpoint_url || "",
    source_type: meta.sourceType || "web",
    active: row.enabled !== false,
    trusted: meta.trusted === true,
    auto_publish: meta.autoPublish === true,
    last_synced_at: meta.lastSyncedAt || null,
    last_sync_status: meta.lastSyncStatus || null,
    last_sync_result: meta.lastSyncResult ?? null,
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
  };
}

export async function requireAdminAccess(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");

  const [{ data: roleRow, error: roleError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("role").eq("id", data.user.id).maybeSingle(),
    ]);

  if (roleError && profileError) {
    throw new Error("Não foi possível validar a permissão administrativa.");
  }

  const isAdmin = Boolean(roleRow) || profile?.role === "admin";
  if (!isAdmin) throw new Error("Acesso restrito a administradores.");
  return data.user;
}

async function ensureNotionSource() {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("publication_destinations")
    .select("id,nome,endpoint_url,provider,enabled,field_mapping,created_at,updated_at")
    .eq("provider", FEED_PROVIDER)
    .eq("endpoint_url", NOTION_URL)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing as PublicationDestinationRow;

  const { data, error } = await supabaseAdmin
    .from("publication_destinations")
    .insert({
      nome: "Agenda Cultural Inimigos do Fim — Notion",
      endpoint_url: NOTION_URL,
      provider: FEED_PROVIDER,
      enabled: true,
      field_mapping: {
        sourceType: "notion",
        trusted: true,
        autoPublish: true,
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncResult: null,
      },
      updated_at: new Date().toISOString(),
    })
    .select("id,nome,endpoint_url,provider,enabled,field_mapping,created_at,updated_at")
    .single();
  if (error) throw error;
  return data as PublicationDestinationRow;
}

export async function listFeedSourcesForAdmin(accessToken: string) {
  await requireAdminAccess(accessToken);
  await ensureNotionSource();

  const { data, error } = await supabaseAdmin
    .from("publication_destinations")
    .select("id,nome,endpoint_url,provider,enabled,field_mapping,created_at,updated_at")
    .eq("provider", FEED_PROVIDER)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data || []) as PublicationDestinationRow[]).map(normalizeSource);
}

export async function saveFeedSourceForAdmin(
  accessToken: string,
  input: {
    id?: string;
    name: string;
    url: string;
    active: boolean;
    trusted: boolean;
    autoPublish: boolean;
  },
) {
  await requireAdminAccess(accessToken);
  const url = new URL(input.url.trim()).toString();
  const detectedSourceType = sourceType(url);
  const now = new Date().toISOString();

  if (!input.name.trim()) throw new Error("Informe um nome para a fonte.");

  if (input.id) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from("publication_destinations")
      .select("field_mapping")
      .eq("id", input.id)
      .eq("provider", FEED_PROVIDER)
      .single();
    if (currentError) throw currentError;
    const currentMeta = metadata(current.field_mapping);

    const { data, error } = await supabaseAdmin
      .from("publication_destinations")
      .update({
        nome: input.name.trim(),
        endpoint_url: url,
        enabled: input.active,
        field_mapping: {
          ...currentMeta,
          sourceType: detectedSourceType,
          trusted: input.trusted,
          autoPublish: input.trusted && input.autoPublish,
        },
        updated_at: now,
      })
      .eq("id", input.id)
      .eq("provider", FEED_PROVIDER)
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  }

  const { data: duplicate, error: duplicateError } = await supabaseAdmin
    .from("publication_destinations")
    .select("id")
    .eq("provider", FEED_PROVIDER)
    .eq("endpoint_url", url)
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate?.id) throw new Error("Essa URL já está cadastrada como fonte.");

  const { data, error } = await supabaseAdmin
    .from("publication_destinations")
    .insert({
      nome: input.name.trim(),
      endpoint_url: url,
      provider: FEED_PROVIDER,
      enabled: input.active,
      field_mapping: {
        sourceType: detectedSourceType,
        trusted: input.trusted,
        autoPublish: input.trusted && input.autoPublish,
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncResult: null,
      },
      updated_at: now,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function removeFeedSourceForAdmin(accessToken: string, id: string) {
  await requireAdminAccess(accessToken);
  const { data: source, error: sourceError } = await supabaseAdmin
    .from("publication_destinations")
    .select("endpoint_url,field_mapping")
    .eq("id", id)
    .eq("provider", FEED_PROVIDER)
    .single();
  if (sourceError) throw sourceError;

  const meta = metadata(source.field_mapping);
  if (meta.sourceType === "notion" && source.endpoint_url === NOTION_URL) {
    throw new Error("A fonte principal do Notion não pode ser removida. Você pode pausá-la.");
  }

  const { error } = await supabaseAdmin
    .from("publication_destinations")
    .delete()
    .eq("id", id)
    .eq("provider", FEED_PROVIDER);
  if (error) throw error;
  return { ok: true };
}

export async function syncFeedSourceForAdmin(accessToken: string, id: string) {
  await requireAdminAccess(accessToken);
  const { data, error } = await supabaseAdmin
    .from("publication_destinations")
    .select("id,nome,endpoint_url,provider,enabled,field_mapping,created_at,updated_at")
    .eq("id", id)
    .eq("provider", FEED_PROVIDER)
    .single();
  if (error) throw error;

  const sourceRecord = normalizeSource(data as PublicationDestinationRow);
  if (!sourceRecord.active) throw new Error("Esta fonte está pausada.");
  if (!sourceRecord.url) throw new Error("A fonte não possui URL configurada.");

  const source: FeedSource = {
    id: sourceRecord.id,
    name: sourceRecord.name,
    url: sourceRecord.url,
    trusted: sourceRecord.trusted,
    autoPublish: sourceRecord.auto_publish,
    sourceType: sourceRecord.source_type as FeedSource["sourceType"],
  };

  const currentMeta = metadata(data.field_mapping);
  try {
    const result = await ingestFeedSource(source);
    await supabaseAdmin
      .from("publication_destinations")
      .update({
        field_mapping: {
          ...currentMeta,
          lastSyncedAt: new Date().toISOString(),
          lastSyncStatus: "sucesso",
          lastSyncResult: result,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return result;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha ao sincronizar fonte.";
    await supabaseAdmin
      .from("publication_destinations")
      .update({
        field_mapping: {
          ...currentMeta,
          lastSyncedAt: new Date().toISOString(),
          lastSyncStatus: "erro",
          lastSyncResult: { error: message },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    throw new Error(message);
  }
}

export async function syncAllConfiguredFeedSources() {
  await ensureNotionSource();
  const { data, error } = await supabaseAdmin
    .from("publication_destinations")
    .select("id,nome,endpoint_url,provider,enabled,field_mapping,created_at,updated_at")
    .eq("provider", FEED_PROVIDER)
    .eq("enabled", true)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const results = [];
  for (const row of (data || []) as PublicationDestinationRow[]) {
    const record = normalizeSource(row);
    const currentMeta = metadata(row.field_mapping);
    try {
      const result = await ingestFeedSource({
        id: record.id,
        name: record.name,
        url: record.url,
        trusted: record.trusted,
        autoPublish: record.auto_publish,
        sourceType: record.source_type as FeedSource["sourceType"],
      });
      await supabaseAdmin
        .from("publication_destinations")
        .update({
          field_mapping: {
            ...currentMeta,
            lastSyncedAt: new Date().toISOString(),
            lastSyncStatus: "sucesso",
            lastSyncResult: result,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id);
      results.push({ ok: true, id: record.id, ...result });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Falha ao sincronizar fonte.";
      await supabaseAdmin
        .from("publication_destinations")
        .update({
          field_mapping: {
            ...currentMeta,
            lastSyncedAt: new Date().toISOString(),
            lastSyncStatus: "erro",
            lastSyncResult: { error: message },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id);
      results.push({ ok: false, id: record.id, source: record.name, error: message });
    }
  }
  return results;
}

export async function getLegacyNotionStatus(accessToken: string) {
  await requireAdminAccess(accessToken);
  const { data, error } = await supabaseAdmin
    .from("interpreted_contents")
    .select("id,review_status")
    .contains("extracted_data", { feedSourceId: "legacy-notion-agenda" });
  if (error) throw error;
  const rows = data || [];
  return {
    total: rows.length,
    published: rows.filter((row) => row.review_status === "publicado").length,
    review: rows.filter((row) => row.review_status === "necessita_revisao").length,
  };
}
