const CATEGORY_IMAGES = {
  musica: "/images/categories/musica.webp",
  teatro: "/images/categories/teatro.webp",
  danca: "/images/categories/danca.webp",
  cinema: "/images/categories/cinema.webp",
  literatura: "/images/categories/literatura.webp",
  oficina: "/images/categories/oficina.webp",
  outros: "/images/categories/outros.webp",
} as const;

function normalizeCategory(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function categoryIllustration(category?: string | null) {
  const value = normalizeCategory(category);

  if (/cinema|audiovisual|filme|cineclube|mostra de filme/.test(value)) {
    return CATEGORY_IMAGES.cinema;
  }
  if (/literatura|livro|leitura|poesia|sarau|conto|escrita/.test(value)) {
    return CATEGORY_IMAGES.literatura;
  }
  if (/oficina|workshop|curso|formacao|vivencia|aula/.test(value)) {
    return CATEGORY_IMAGES.oficina;
  }
  if (/teatro|artes cenicas|circo|palhaco|espetaculo cenico/.test(value)) {
    return CATEGORY_IMAGES.teatro;
  }
  if (/danca|baile|ballet|bale|capoeira|performance corporal/.test(value)) {
    return CATEGORY_IMAGES.danca;
  }
  if (/musica|show|concerto|samba|forro|rap|hip hop|jazz|coral|banda|dj/.test(value)) {
    return CATEGORY_IMAGES.musica;
  }

  return CATEGORY_IMAGES.outros;
}
