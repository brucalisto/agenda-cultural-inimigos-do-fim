import { describe, expect, test } from "bun:test";

import {
  duplicateSameDay,
  normalizeDuplicateText,
  scoreDuplicatePair,
} from "@/lib/duplicate-score";

describe("duplicate-score", () => {
  test("normaliza acentos e pontuação no título", () => {
    expect(normalizeDuplicateText("Show de Lançamento — Esphera!"))
      .toBe("show de lancamento esphera");
  });

  test("considera o mesmo dia civil no fuso da agenda", () => {
    expect(duplicateSameDay("2026-09-27T22:00:00.000Z", "2026-09-27T19:00:00-03:00")).toBe(true);
  });

  test("dá alta confiança para mesmo título e mesma data", () => {
    const result = scoreDuplicatePair(
      {
        title: "Show de lançamento do álbum Esphera",
        event_date: "2026-09-27T22:00:00.000Z",
        location: "Teatro Mario Covas",
        city: "Caraguatatuba",
      },
      {
        title: "Show de lançamento do album Esphera",
        event_date: "2026-09-27T19:00:00-03:00",
        location: "Teatro Mario Covas",
        city: "Caraguatatuba",
      },
    );

    expect(result.total).toBeGreaterThanOrEqual(0.93);
    expect(result.reasons).toContain("mesmo título normalizado");
    expect(result.reasons).toContain("mesma data");
  });

  test("não marca eventos claramente diferentes como duplicados", () => {
    const result = scoreDuplicatePair(
      { title: "Oficina de cerâmica", event_date: "2026-09-20T10:00:00-03:00", city: "Caraguatatuba" },
      { title: "Concerto sinfônico", event_date: "2026-09-27T19:00:00-03:00", city: "Ubatuba" },
    );
    expect(result.total).toBeLessThan(0.72);
  });
});
