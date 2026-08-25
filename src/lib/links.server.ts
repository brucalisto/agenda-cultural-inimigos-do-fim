const MAX_HTML_BYTES = 1_000_000;
const MAX_IMAGE_BYTES = 10_000_000;
function isBlockedHost(host: string) {
  host = host.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host)
  )
    return true;
  const match = host.match(/^172\.(\d+)\./);
  const octet = match?.[1];
  return Boolean(octet && +octet >= 16 && +octet <= 31);
}
const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
const plainText = (html: string) =>
  decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

function metaContent(html: string, key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (property !== key.toLowerCase()) continue;
    return decodeEntities(tag.match(/content=["']([^"']+)["']/i)?.[1] || "") || null;
  }
  return null;
}

export async function extractPublicPage(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname))
    throw new Error("Endereço não permitido.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; AgendaCulturalBot/1.0)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (+(response.headers.get("content-length") || 0) > MAX_HTML_BYTES)
      throw new Error("Página muito grande.");
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("text/plain"))
      return { title: null, description: null, imageUrl: null, text: `Conteúdo remoto ${type}.` };
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return {
      title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || null,
      description: metaContent(html, "og:description") || metaContent(html, "description"),
      imageUrl: metaContent(html, "og:image"),
      text: plainText(html).slice(0, 30_000),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadPublicImage(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname))
    throw new Error("Imagem remota não permitida.");
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
    headers: { "user-agent": "Mozilla/5.0 (compatible; AgendaCulturalBot/1.0)" },
  });
  const finalUrl = new URL(response.url);
  if (isBlockedHost(finalUrl.hostname) || !response.ok)
    throw new Error("Imagem remota indisponível.");
  const mimeType = response.headers.get("content-type")?.split(";")[0] || "";
  if (!mimeType.startsWith("image/")) throw new Error("O endereço não retornou uma imagem.");
  if (Number(response.headers.get("content-length") || 0) > MAX_IMAGE_BYTES)
    throw new Error("Imagem remota muito grande.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Imagem remota muito grande.");
  return { mimeType, data: buffer.toString("base64") };
}
