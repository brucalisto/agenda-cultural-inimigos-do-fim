import { describe, expect, test } from "bun:test";

import {
  eventPriceFilterKind,
  eventPriceStorageValue,
  normalizeEventPrice,
} from "@/lib/event-price";

describe("event-price", () => {
  test("distingue gratuito de valor não informado", () => {
    expect(normalizeEventPrice(null).kind).toBe("unknown");
    expect(normalizeEventPrice("Gratuito").kind).toBe("free");
    expect(eventPriceStorageValue(null)).toBeNull();
    expect(eventPriceStorageValue("entrada franca")).toBe("0");
  });

  test("normaliza preço fixo", () => {
    const result = normalizeEventPrice("R$ 20");
    expect(result.kind).toBe("fixed");
    expect(result.amount).toBe(20);
    expect(eventPriceFilterKind("R$ 20")).toBe("paid");
  });

  test("não transforma condição mista em evento totalmente gratuito", () => {
    const result = normalizeEventPrice("Gratuito para crianças / R$ 20 adultos");
    expect(result.kind).toBe("variable");
    expect(result.amount).toBe(20);
    expect(eventPriceFilterKind("Gratuito para crianças / R$ 20 adultos")).toBe("paid");
  });

  test("preserva faixas e condições variáveis", () => {
    const result = normalizeEventPrice("A partir de R$ 15");
    expect(result.kind).toBe("variable");
    expect(result.amount).toBe(15);
    expect(result.label).toBe("A partir de R$ 15");
  });
});
