function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match?.[1]) return decodeXml(match[1]);
  }
  return null;
}

function link(block: string) {
  const plain = tag(block, ["link", "guid"]);
  if (plain?.startsWith("http")) return plain;
  const href = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
  return href ? decodeXml(href) : null;
}

export async function extractRssFeed(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
  });
  if (!response.ok) throw new Error(`Feed RSS respondeu ${response.status}.`);
  const xml = await response.text();
  const blocks = xml.match(/<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi) || [];
  if (!blocks.length) throw new Error("A URL não retornou itens RSS/Atom reconhecíveis.");
  const items = blocks.slice(0, 100).map((block) => ({
    title: tag(block, ["title"]),
    description: tag(block, ["description", "summary", "content", "content:encoded"]),
    publishedAt: tag(block, ["pubDate", "published", "updated"]),
    link: link(block),
  }));
  return items
    .map((item, index) =>
      [
        `ITEM ${index + 1}`,
        item.title && `Título: ${item.title}`,
        item.publishedAt && `Publicado em: ${item.publishedAt}`,
        item.link && `Link: ${item.link}`,
        item.description && `Conteúdo: ${item.description}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
