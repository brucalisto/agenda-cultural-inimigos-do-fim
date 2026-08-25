import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ingestFeedSource, type FeedSource } from "@/lib/feeds.server";

type FeedSourceRecord = {
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

const db = supabaseAdmin as unknown as {
  from: (table: string) => any;
  auth: typeof supabaseAdmin.auth;
};

export async function requireAdminAccess(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");

  const [{ data: roleRow, error: roleError }, { data: profile, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle(),
  ]);

  if (roleError && profileError) {
    throw new Error("Não foi possível validar a permissão administrativa.");
  }

  const isAdmin = Boolean(roleRow) || profile?.role === "admin";
  if (!isAdmin) throw new Error("Acesso restrito a administradores.");
  return data.user;
}

export async function listFeedSourcesForAdmin(accessToken: string) {
  await requireAdminAccess(accessToken);
  const { data, error } = await db
    .from("feed_sources")
    .select("id,name,url,source_type,active,trusted,auto_publish,last_synced_at,last_sync_status,last_sync_result,created_at,updated_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as FeedSourceRecord[];
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
  const payload = {
    name: input.name.trim(),
    url,
    source_type: url.includes("notion.site") || url.includes("notion.com") ? "notion" : "web",
    active: input.active,
    trusted: input.trusted,
    auto_publish: input.autoPublish,
    updated_at: new Date().toISOString(),
  };

  if (!payload.name) throw new Error("Informe um nome para a fonte.");

  const query = input.id
    ? db.from("feed_sources").update(payload).eq("id", input.id)
    : db.from("feed_sources").insert(payload);
  const { data, error } = await query.select("id").single();
  if (error) throw error;
  return { id: data.id };
}

export async function removeFeedSourceForAdmin(accessToken: string, id: string) {
  await requireAdminAccess(accessToken);
  const { data: source, error: sourceError } = await db
    .from("feed_sources")
    .select("source_type")
    .eq("id", id)
    .single();
  if (sourceError) throw sourceError;
  if (source?.source_type === "notion") {
    throw new Error("A fonte principal do Notion não pode ser removida. Você pode pausá-la.");
  }
  const { error } = await db.from("feed_sources").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function syncFeedSourceForAdmin(accessToken: string, id: string) {
  await requireAdminAccess(accessToken);
  const { data, error } = await db
    .from("feed_sources")
    .select("id,name,url,source_type,active,trusted,auto_publish")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (!data.active) throw new Error("Esta fonte está pausada.");

  const source: FeedSource = {
    id: data.id,
    name: data.name,
    url: data.url,
    trusted: data.trusted,
    autoPublish: data.auto_publish,
  };

  try {
    const result = await ingestFeedSource(source);
    await db
      .from("feed_sources")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: "sucesso",
        last_sync_result: result,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return result;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha ao sincronizar fonte.";
    await db
      .from("feed_sources")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: "erro",
        last_sync_result: { error: message },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    throw new Error(message);
  }
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
