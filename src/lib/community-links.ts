export function normalizeContactUrl(value: string | null | undefined) {
  const input = value?.trim();
  if (!input) return null;
  if (/^https?:\/\//i.test(input)) return input;
  if (/^mailto:/i.test(input) || /^tel:/i.test(input)) return input;
  if (input.startsWith("@")) return `https://instagram.com/${input.slice(1)}`;
  const digits = input.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15) {
    const number = digits.startsWith("55") ? digits : `55${digits}`;
    return `https://wa.me/${number}`;
  }
  if (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(input)) return `https://${input}`;
  return null;
}
