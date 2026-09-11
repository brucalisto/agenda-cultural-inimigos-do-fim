import { extractPublicPage, loadPublicImage } from "@/lib/links.server";

const INSTAGRAM_HOST = /(^|\.)instagram\.com$/i;
const MAX_POSTS = 12;
const DEFAULT_GRAPH_API_VERSION = "v26.0";

export type InstagramPublicPost = {
  shortcode: string;
  url: string;
  title: string | null;
  description: string | null;
  text: string;
  imageUrls: string[];
};

type MetaConfig = {
  accessToken: string;
  igUserId: string;
  version: string;
};

type MetaMediaChild = {
  media_type?: string | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
  permalink?: string | null;
};

type MetaMedia = {
  id?: string | null;
  caption?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
  permalink?: string | null;
  timestamp?: string | null;
  children?: { data?: MetaMediaChild[] | null } | null;
};

type MetaBusinessDiscovery = {
  username?: string | null;
  name?: string | null;
  media?: { data?: MetaMedia[] | null } | null;
};

type MetaResponse = {
  business_discovery?: MetaBusinessDiscovery | null;
  error?: {
    message?: string | null;
    type?: string | null;
    code?: number | null;
    error_subcode?: number | null;
  } | null;
};

const metaPostCache = new Map<string, InstagramPublicPost>();

function assertInstagramUrl(input: string) {
  const url = new URL(input);
  if (!INSTAGRAM_HOST.test(url.hostname)) throw new Error("A fonte não é do Instagram.");
  return url;
}

function shortcodeFromUrl(input: string) {
  const url = assertInstagramUrl(input);
  return url.pathname.match(/^\/(?:p|reel|tv)\/([^/]+)/i)?.[1] || null;
}

function profileUsernameFromUrl(input: string) {
  const url = assertInstagramUrl(input);
  if (shortcodeFromUrl(input)) return null;
  const username = url.pathname.split("/").filter(Boolean)[0]?.trim() || "";
  if (!username || !/^[A-Za-z0-9._]+$/.test(username)) return null;
  if (["accounts", "explore", "direct", "reels", "stories"].includes(username.toLowerCase())) return null;
  return username;
}

function normalizePostUrl(input: string) {
  const url = assertInstagramUrl(input);
  const match = url.pathname.match(/^\/(p|reel|tv)\/([^/]+)/i);
  if (!match) return null;
  return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/`;
}

function uniq<T>(values: T[]) {
  return [...new Set(values)];
}

function decodeJsonString(value: string) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string;
  } catch {
    const bs = String.fromCharCode(92);
    return value.split(bs + "u0026").join("&").split(bs + "/").join("/");
  }
}

function metaConfig(): MetaConfig | null {
  const accessToken = process.env["META_INSTAGRAM_ACCESS_TOKEN"]?.trim() || "";
  const igUserId = process.env["META_INSTAGRAM_ACCOUNT_ID"]?.trim() || "";
  const configuredVersion = process.env["META_GRAPH_API_VERSION"]?.trim() || DEFAULT_GRAPH_API_VERSION;

  if (!accessToken && !igUserId) return null;
  if (!accessToken || !igUserId) {
    throw new Error(
      "Configuração da Meta incompleta. Configure META_INSTAGRAM_ACCESS_TOKEN e META_INSTAGRAM_ACCOUNT_ID no ambiente do servidor.",
    );
  }

  const version = /^v\d+\.\d+$/.test(configuredVersion)
    ? configuredVersion
    : DEFAULT_GRAPH_API_VERSION;
  return { accessToken, igUserId, version };
}

function metaImageUrls(media: MetaMedia) {
  const childImages = (media.children?.data || [])
    .map((child) => {
      if (child.media_type === "VIDEO") return child.thumbnail_url || null;
      return child.media_url || child.thumbnail_url || null;
    })
    .filter((value): value is string => Boolean(value));

  if (childImages.length) return uniq(childImages).slice(0, 10);
  if (media.media_type === "VIDEO") {
    return media.thumbnail_url ? [media.thumbnail_url] : [];
  }
  return media.media_url ? [media.media_url] : [];
}

function metaPost(media: MetaMedia, username: string): InstagramPublicPost | null {
  if (!media.permalink) return null;
  const normalized = normalizePostUrl(media.permalink);
  if (!normalized) return null;
  const shortcode = shortcodeFromUrl(normalized);
  if (!shortcode) return null;

  const caption = media.caption?.trim() || null;
  const timestamp = media.timestamp ? new Date(media.timestamp) : null;
  const timestampLabel =
    timestamp && !Number.isNaN(timestamp.getTime())
      ? timestamp.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : null;
  const title = [username ? `@${username}` : null, timestampLabel].filter(Boolean).join(" · ") || null;

  return {
    shortcode,
    url: normalized,
    title,
    description: caption,
    text: caption || `Publicação do Instagram ${normalized}`,
    imageUrls: metaImageUrls(media),
  };
}

async function fetchMetaDiscovery(
  config: MetaConfig,
  username: string,
  includeChildren: boolean,
): Promise<MetaResponse> {
  const mediaFields = includeChildren
    ? "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url,permalink}"
    : "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  const fields = `business_discovery.username(${username}){username,name,media.limit(${MAX_POSTS}){${mediaFields}}}`;
  const endpoint = new URL(
    `https://graph.facebook.com/${config.version}/${encodeURIComponent(config.igUserId)}`,
  );
  endpoint.searchParams.set("fields", fields);

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.accessToken}`,
    },
  });

  let payload: MetaResponse;
  try {
    payload = (await response.json()) as MetaResponse;
  } catch {
    throw new Error(`A API da Meta respondeu HTTP ${response.status} sem JSON válido.`);
  }

  if (!response.ok || payload.error) {
    const detail = payload.error?.message || `HTTP ${response.status}`;
    throw new Error(`A API da Meta não conseguiu consultar @${username}: ${detail}`);
  }
  return payload;
}

async function discoverInstagramPostsWithMeta(sourceUrl: string, config: MetaConfig) {
  const username = profileUsernameFromUrl(sourceUrl);
  if (!username) throw new Error("Informe a URL de um perfil do Instagram para monitoramento contínuo.");

  let payload: MetaResponse;
  try {
    payload = await fetchMetaDiscovery(config, username, true);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    // Algumas versões/contas podem não expor children dentro de Business Discovery.
    // Nesse caso, ainda coletamos legenda e a mídia principal pelo endpoint oficial.
    if (!/children|field|campo/i.test(message)) throw cause;
    payload = await fetchMetaDiscovery(config, username, false);
  }

  const discovered = payload.business_discovery;
  if (!discovered) {
    throw new Error(
      `A API da Meta não retornou Business Discovery para @${username}. Confirme se o perfil é Business ou Creator e está público.`,
    );
  }

  const resolvedUsername = discovered.username || username;
  const posts = (discovered.media?.data || [])
    .map((media) => metaPost(media, resolvedUsername))
    .filter((post): post is InstagramPublicPost => Boolean(post));

  if (!posts.length) {
    throw new Error(`A API da Meta não retornou publicações recentes de @${resolvedUsername}.`);
  }

  for (const post of posts) metaPostCache.set(post.url, post);
  return posts.map((post) => post.url);
}

async function fetchInstagramHtml(input: string) {
  const url = assertInstagramUrl(input);
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`Instagram respondeu HTTP ${response.status}.`);
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) throw new Error("Instagram não retornou uma página HTML pública.");
  return (await response.text()).slice(0, 2_000_000);
}

function discoverPostUrlsFromHtml(html: string) {
  const urls: string[] = [];

  const bs = String.fromCharCode(92);
  const s = "(?:" + bs + bs + ")?/";
  const absolute = new RegExp(
    "https:" + s + s + "(?:www" + bs + bs + ".)?instagram" + bs + bs + ".com" + s +
      "(p|reel|tv)" + s + "([A-Za-z0-9_-]+)",
    "gi",
  );
  let match: RegExpExecArray | null;
  while ((match = absolute.exec(html))) {
    urls.push(`https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/`);
  }

  const href = /href=["']\/(p|reel|tv)\/([^/"'?&]+)\/[^"']*["']/gi;
  while ((match = href.exec(html))) {
    urls.push(`https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/`);
  }

  const shortcodePatterns = [
    /"shortcode"\s*:\s*"([A-Za-z0-9_-]+)"/gi,
    /"code"\s*:\s*"([A-Za-z0-9_-]{5,})"/gi,
  ];
  for (const pattern of shortcodePatterns) {
    while ((match = pattern.exec(html))) {
      if (match[1]) urls.push(`https://www.instagram.com/p/${match[1]}/`);
    }
  }

  return uniq(urls).slice(0, MAX_POSTS);
}

function imageUrlsFromHtml(html: string) {
  const urls: string[] = [];
  const patterns = [
    /"display_url"\s*:\s*"([^"]+)"/gi,
    /"image_versions2"[\s\S]{0,4000}?"url"\s*:\s*"([^"]+)"/gi,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html))) {
      if (match[1]) urls.push(decodeJsonString(match[1]));
      if (urls.length >= 10) break;
    }
  }
  return uniq(urls.filter((value) => /^https?:\/\//i.test(value))).slice(0, 10);
}

export async function discoverInstagramPosts(sourceUrl: string) {
  const direct = normalizePostUrl(sourceUrl);
  if (direct) return [direct];

  const config = metaConfig();
  if (config) return discoverInstagramPostsWithMeta(sourceUrl, config);

  // Compatibilidade temporária: enquanto os secrets da Meta não forem configurados,
  // mantém a leitura pública anterior. Assim a publicação do código não derruba o fluxo atual.
  const html = await fetchInstagramHtml(sourceUrl);
  const discovered = discoverPostUrlsFromHtml(html);
  if (!discovered.length) {
    throw new Error(
      "O Instagram não expôs publicamente os posts recentes desta fonte. Configure META_INSTAGRAM_ACCESS_TOKEN e META_INSTAGRAM_ACCOUNT_ID para usar a API oficial da Meta.",
    );
  }
  return discovered;
}

export async function extractInstagramPublicPost(postUrl: string): Promise<InstagramPublicPost> {
  const normalized = normalizePostUrl(postUrl);
  if (!normalized) throw new Error("URL de publicação do Instagram inválida.");

  const cachedMetaPost = metaPostCache.get(normalized);
  if (cachedMetaPost) return cachedMetaPost;

  // URLs diretas de post continuam com fallback público, pois o Business Discovery
  // é orientado ao perfil monitorado. Fontes de perfil usam a API oficial acima.
  const shortcode = shortcodeFromUrl(normalized) as string;
  let pageTitle: string | null = null;
  let description: string | null = null;
  let text = "";
  let imageUrls: string[] = [];

  try {
    const page = await extractPublicPage(normalized);
    pageTitle = page.title;
    description = page.description;
    text = [page.title, page.description, page.text].filter(Boolean).join("\n\n");
    if (page.imageUrl) imageUrls.push(page.imageUrl);
  } catch {
    // Continua com a leitura HTML abaixo.
  }

  try {
    const html = await fetchInstagramHtml(normalized);
    imageUrls = uniq([...imageUrls, ...imageUrlsFromHtml(html)]);
    const embeddedCaption =
      html.match(/"caption"\s*:\s*\{[\s\S]{0,2500}?"text"\s*:\s*"([^"]*)"/i)?.[1] ||
      html.match(/"edge_media_to_caption"[\s\S]{0,2500}?"text"\s*:\s*"([^"]*)"/i)?.[1] ||
      null;
    if (embeddedCaption) {
      const caption = decodeJsonString(embeddedCaption);
      if (!text.includes(caption)) text = [text, caption].filter(Boolean).join("\n\n");
      if (!description) description = caption;
    }
  } catch {
    if (!text && !imageUrls.length) {
      throw new Error(
        "O Instagram bloqueou a leitura pública desta publicação. Para monitoramento contínuo, cadastre a URL do perfil e use a API oficial da Meta.",
      );
    }
  }

  return {
    shortcode,
    url: normalized,
    title: pageTitle,
    description,
    text: text || `Publicação do Instagram ${normalized}`,
    imageUrls,
  };
}

export async function loadInstagramImages(imageUrls: string[]) {
  const media: Array<{ mimeType: string; data: string }> = [];
  for (const imageUrl of imageUrls.slice(0, 6)) {
    try {
      media.push(await loadPublicImage(imageUrl));
    } catch {
      // URLs do Instagram expiram com frequência; imagem é enriquecimento opcional.
    }
  }
  return media;
}
