export function normalizeWhatsAppGroupId(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeWhatsAppGroupName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
