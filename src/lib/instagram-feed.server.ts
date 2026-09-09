import { extractPublicPage, loadPublicImage } from "@/lib/links.server";

const INSTAGRAM_HOST = /(^|\.)instagram\.com$/i;
const MAX_POSTS = 12;

export type InstagramPublicPost = {
  shortcode: string;
  url: string;
  title: string | null;
  description: string | null;
  text: string;
  imageUrls: string[];
};

function assertInstagramUrl(input: string) {
  const url = new URL(input);
  if (!INSTAGRAM_HOST.test(url.hostname)) throw new Error("A fonte não é do Instagram.");
  return url;
}

function shortcodeFromUrl(input: string) {
  const url = assertInstagramUrl(input);
  return url.pathname.match(/^\/(?:p|reel|tv)\/([^/]+)/i)?.[1] || null;
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
    return value.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  }
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

  const absolute = /https:\\/\\/(?:www\.)?instagram\.com\\/(p|reel|tv)\\/([^\\/"?&]+)/gi;
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
  const html = await fetchInstagramHtml(sourceUrl);
  const discovered = discoverPostUrlsFromHtml(html);
  if (!discovered.length) {
    throw new Error(
      "O Instagram não expôs publicamente os posts recentes desta fonte. A coleta pública pode estar temporariamente bloqueada.",
    );
  }
  return discovered;
}

export async function extractInstagramPublicPost(postUrl: string): Promise<InstagramPublicPost> {
  const normalized = normalizePostUrl(postUrl);
  if (!normalized) throw new Error("URL de publicação do Instagram inválida.");
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
        "O Instagram bloqueou a leitura pública desta publicação. A fonte será tentada novamente na próxima sincronização.",
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
