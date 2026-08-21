const MAX_HTML_BYTES = 1_000_000;
function isBlockedHost(host: string) {
  host = host.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./); return Boolean(match && +match[1] >= 16 && +match[1] <= 31);
}
const plainText = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
export async function extractPublicPage(input: string) {
  const url = new URL(input);
  if (!["http:","https:"].includes(url.protocol) || isBlockedHost(url.hostname)) throw new Error("Endereço não permitido.");
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { redirect:"follow", signal:controller.signal, headers:{"user-agent":"AgendaCulturalBot/1.0"} });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (+(response.headers.get("content-length") || 0) > MAX_HTML_BYTES) throw new Error("Página muito grande.");
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return { title:null, description:null, text:`Conteúdo remoto ${type}.` };
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return { title:html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || null, description:html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i)?.[1] || null, text:plainText(html).slice(0,30_000) };
  } finally { clearTimeout(timeout); }
}
