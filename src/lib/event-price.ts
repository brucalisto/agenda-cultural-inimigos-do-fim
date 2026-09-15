export type EventPriceKind = "free" | "fixed" | "variable" | "unknown";

export type EventPriceInfo = {
  kind: EventPriceKind;
  amount: number | null;
  label: string;
  raw: string | number | null;
};

const FREE_RE = /\b(?:gr[aá]tis|gratuito|gratuita|entrada\s+franca|free)\b/i;
const UNKNOWN_RE = /\b(?:n[aã]o\s+informad[oa]|sem\s+informa[cç][aã]o|a\s+definir)\b/i;
const VARIABLE_RE = /\b(?:a\s+partir\s+de|meia|inteira|lote|antecipad[oa]|na\s+porta|na\s+hora|contribui[cç][aã]o|colabora[cç][aã]o|pague\s+quanto\s+puder|sob\s+consulta|a\s+combinar|faixa|de\s+r\$?)\b/i;

function parseDecimal(value: string) {
  const cleaned = value.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function monetaryNumbers(value: string) {
  const matches = value.match(/\d+(?:[.,]\d{1,2})?/g) || [];
  return matches
    .map(parseDecimal)
    .filter((item): item is number => item !== null && item >= 0);
}

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function normalizeEventPrice(input: string | number | null | undefined): EventPriceInfo {
  if (input == null || input === "") {
    return { kind: "unknown", amount: null, label: "Valor não informado", raw: null };
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      return { kind: "unknown", amount: null, label: "Valor não informado", raw: input };
    }
    if (input === 0) return { kind: "free", amount: 0, label: "Gratuito", raw: input };
    return { kind: "fixed", amount: input, label: brl(input), raw: input };
  }

  const raw = input.trim().replace(/\s+/g, " ");
  if (!raw || UNKNOWN_RE.test(raw)) {
    return { kind: "unknown", amount: null, label: "Valor não informado", raw: input };
  }
  if (FREE_RE.test(raw) || /^(?:r\$\s*)?0(?:[.,]00)?$/i.test(raw)) {
    return {
      kind: "free",
      amount: 0,
      label: FREE_RE.test(raw) && raw.length > 10 ? raw : "Gratuito",
      raw: input,
    };
  }

  const values = monetaryNumbers(raw);
  const isVariable = VARIABLE_RE.test(raw) || values.length > 1;
  if (isVariable) {
    return {
      kind: "variable",
      amount: values.length ? Math.min(...values.filter((value) => value > 0)) || null : null,
      label: raw,
      raw: input,
    };
  }

  if (values.length === 1) {
    const amount = values[0];
    return {
      kind: amount === 0 ? "free" : "fixed",
      amount,
      label: amount === 0 ? "Gratuito" : /^r\$/i.test(raw) ? raw : brl(amount),
      raw: input,
    };
  }

  return { kind: "unknown", amount: null, label: raw || "Valor não informado", raw: input };
}

export function eventPriceStorageValue(input: string | number | null | undefined) {
  const info = normalizeEventPrice(input);
  if (info.kind === "unknown") return null;
  if (info.kind === "free") return "0";
  return info.label;
}

export function eventPriceFilterKind(input: string | number | null | undefined) {
  const kind = normalizeEventPrice(input).kind;
  return kind === "free" ? "free" : kind === "unknown" ? "unknown" : "paid";
}

export function formatEventPrice(input: string | number | null | undefined) {
  return normalizeEventPrice(input).label;
}

export function eventPriceMetadata(input: string | number | null | undefined) {
  const info = normalizeEventPrice(input);
  return {
    kind: info.kind,
    amount: info.amount,
    label: info.label,
    raw: info.raw,
  };
}
