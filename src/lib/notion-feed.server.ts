type NotionRichText = { plain_text?: string };

type NotionProperty = {
  type?: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  select?: { name?: string } | null;
  multi_select?: Array<{ name?: string }>;
  status?: { name?: string } | null;
  date?: { start?: string; end?: string | null } | null;
  url?: string | null;
  phone_number?: string | null;
  email?: string | null;
  number?: number | null;
  checkbox?: boolean;
  files?: Array<{
    type?: "file" | "external";
    file?: { url?: string };
    external?: { url?: string };
  }>;
  formula?: {
    type?: string;
    string?: string | null;
    number?: number | null;
    boolean?: boolean | null;
    date?: { start?: string } | null;
  };
};

type NotionPage = {
  id: string;
  url?: string;
  archived?: boolean;
  in_trash?: boolean;
  last_edited_time?: string;
  cover?: {
    type?: "file" | "external";
    file?: { url?: string };
    external?: { url?: string };
  } | null;
  properties?: Record<string, NotionProperty>;
};

export type NotionEventRow = {
  externalKey: string;
  title: string | null;
  category: string | null;
  summary: string | null;
  full_description: string | null;
  event_date: string | null;
  event_end: string | null;
  location: string | null;
  city: string | null;
  price: string | null;
  source_url: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_instagram: string | null;
  image_url: string | null;
  status: string | null;
  lastEditedAt: string | null;
};

const NOTION_VERSION = "2025-09-03";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function text(property?: NotionProperty) {
  if (!property) return null;
  if (property.type === "title")
    return (
      property.title
        ?.map((item) => item.plain_text || "")
        .join("")
        .trim() || null
    );
  if (property.type === "rich_text")
    return (
      property.rich_text
        ?.map((item) => item.plain_text || "")
        .join("")
        .trim() || null
    );
  if (property.type === "select") return property.select?.name || null;
  if (property.type === "status") return property.status?.name || null;
  if (property.type === "multi_select")
    return (
      property.multi_select
        ?.map((item) => item.name)
        .filter(Boolean)
        .join(", ") || null
    );
  if (property.type === "url") return property.url || null;
  if (property.type === "phone_number") return property.phone_number || null;
  if (property.type === "email") return property.email || null;
  if (property.type === "number") return property.number == null ? null : String(property.number);
  if (property.type === "checkbox") return property.checkbox ? "Sim" : "Não";
  if (property.type === "formula") {
    const formula = property.formula;
    if (formula?.type === "string") return formula.string || null;
    if (formula?.type === "number") return formula.number == null ? null : String(formula.number);
    if (formula?.type === "boolean")
      return formula.boolean == null ? null : formula.boolean ? "Sim" : "Não";
    if (formula?.type === "date") return formula.date?.start || null;
  }
  return null;
}

function property(properties: Record<string, NotionProperty>, aliases: string[]) {
  const normalizedAliases = aliases.map(normalize);
  const entry = Object.entries(properties).find(([name]) =>
    normalizedAliases.includes(normalize(name)),
  );
  return entry?.[1];
}

function value(properties: Record<string, NotionProperty>, aliases: string[]) {
  return text(property(properties, aliases));
}

function dateValue(properties: Record<string, NotionProperty>, aliases: string[]) {
  const candidate = property(properties, aliases);
  if (candidate?.type === "date") return candidate.date || null;
  const start = text(candidate);
  return start ? { start, end: null } : null;
}

function fileUrl(candidate?: NotionProperty | NotionPage["cover"]) {
  if (!candidate) return null;
  if ("files" in candidate) {
    const first = candidate.files?.[0];
    return first?.file?.url || first?.external?.url || null;
  }
  return candidate.file?.url || candidate.external?.url || null;
}

function databaseIdFromUrl(url: string) {
  const matches = url.match(/[a-f0-9]{32}/gi) || [];
  return matches[0] || null;
}

async function notionFetch(path: string, init?: RequestInit) {
  const token = process.env["NOTION_API_KEY"] || process.env["NOTION_TOKEN"];
  if (!token) {
    throw new Error(
      "Sincronização do Notion não configurada. Cadastre NOTION_API_KEY nos Secrets e compartilhe a base com a integração.",
    );
  }
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Notion respondeu ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

async function resolveDataSourceId(url: string) {
  const configured = process.env["NOTION_DATA_SOURCE_ID"];
  if (configured) return configured;
  const databaseId = process.env["NOTION_DATABASE_ID"] || databaseIdFromUrl(url);
  if (!databaseId) throw new Error("Não foi possível identificar o database_id na URL do Notion.");
  const database = await notionFetch(`/databases/${databaseId}`);
  const dataSources = Array.isArray(database.data_sources)
    ? (database.data_sources as Array<{ id?: string }>)
    : [];
  const dataSourceId = dataSources.find((item) => item.id)?.id;
  if (!dataSourceId)
    throw new Error("A base do Notion não possui uma data source acessível pela integração.");
  return dataSourceId;
}

function mapPage(page: NotionPage): NotionEventRow {
  const properties = page.properties || {};
  const date = dateValue(properties, ["Data e hora", "Data/Hora", "Data", "Quando", "Date"]);
  const sourceUrl = value(properties, ["Fonte", "Link", "URL", "Link oficial", "Origem URL"]);
  return {
    externalKey: `notion:${page.id}`,
    title: value(properties, ["Evento", "Nome", "Título", "Title", "Name"]),
    category: value(properties, ["Categoria", "Tipo", "Linguagem"]),
    summary: value(properties, ["Resumo", "Descrição curta", "Chamada"]),
    full_description: value(properties, [
      "Descrição",
      "Descrição completa",
      "Detalhes",
      "Observações",
    ]),
    event_date: date?.start || null,
    event_end: date?.end || null,
    location: value(properties, ["Local", "Espaço", "Endereço", "Venue"]),
    city: value(properties, ["Cidade", "Município"]),
    price: value(properties, ["Preço", "Valor", "Ingresso"]),
    source_url: sourceUrl || page.url || null,
    contact_name: value(properties, ["Contato", "Responsável", "Produção"]),
    contact_phone: value(properties, ["Telefone", "WhatsApp", "Celular"]),
    contact_instagram: value(properties, ["Instagram", "Perfil"]),
    image_url:
      fileUrl(property(properties, ["Imagem", "Banner", "Capa", "Image", "Foto"])) ||
      fileUrl(page.cover),
    status: value(properties, ["Status", "Situação", "Publicação"]),
    lastEditedAt: page.last_edited_time || null,
  };
}

export async function fetchNotionEvents(url: string) {
  const dataSourceId = await resolveDataSourceId(url);
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const body = JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    const response = await notionFetch(`/data_sources/${dataSourceId}/query`, {
      method: "POST",
      body,
    });
    const results = Array.isArray(response.results) ? (response.results as NotionPage[]) : [];
    pages.push(...results.filter((page) => !page.archived && !page.in_trash));
    cursor =
      response.has_more && typeof response.next_cursor === "string"
        ? response.next_cursor
        : undefined;
  } while (cursor);

  return {
    dataSourceId,
    rows: pages.map(mapPage).filter((row) => row.title || row.event_date),
  };
}
