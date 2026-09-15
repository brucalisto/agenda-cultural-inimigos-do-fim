import { describe, expect, test } from "bun:test";

import { InterpretedContentSchema, normalizeAiEventDate } from "@/lib/gemini/schema";

function baseItem(event_date: string | null, time_was_informed?: boolean) {
  return {
    title: "Evento teste",
    category: "Música",
    summary: "Resumo",
    full_description: "Descrição",
    event_date,
    ...(time_was_informed === undefined ? {} : { time_was_informed }),
    location: "Teatro",
    city: "Caraguatatuba",
    price: null,
    contact_name: null,
    contact_phone: null,
    contact_instagram: null,
    source_url: null,
    keywords: [],
    missing_fields: [],
    warnings: [],
    confidence_score: 0.9,
  };
}

describe("normalização da IA", () => {
  test("interpreta Z como marcador genérico e preserva 19h em São Paulo", () => {
    expect(normalizeAiEventDate("2026-09-27T19:00:00Z")).toBe("2026-09-27T19:00:00-03:00");
  });

  test("preserva offset explícito diferente de UTC", () => {
    expect(normalizeAiEventDate("2026-09-27T19:00:00-03:00")).toBe("2026-09-27T19:00:00-03:00");
  });

  test("marca data sem horário como time_was_informed false", () => {
    const parsed = InterpretedContentSchema.parse(baseItem("2026-09-27"));
    expect(parsed.event_date).toBe("2026-09-27T00:00:00-03:00");
    expect(parsed.time_was_informed).toBe(false);
  });

  test("marca datetime explícito como horário informado", () => {
    const parsed = InterpretedContentSchema.parse(baseItem("2026-09-27T19:00:00Z"));
    expect(parsed.time_was_informed).toBe(true);
    expect(parsed.event_date).toBe("2026-09-27T19:00:00-03:00");
  });

  test("move proveniência para extracted_data sem criar coluna top-level", () => {
    const parsed = InterpretedContentSchema.parse({
      ...baseItem("2026-09-27T19:00:00-03:00"),
      evidence: [
        {
          field: "event_date",
          source: "caption",
          source_ref: "MENSAGEM 1 / Legenda",
          excerpt: "27/09 às 19h",
        },
      ],
    });

    expect(parsed.extracted_data).toEqual({
      fieldEvidence: [
        {
          field: "event_date",
          source: "caption",
          source_ref: "MENSAGEM 1 / Legenda",
          excerpt: "27/09 às 19h",
        },
      ],
    });
    expect("evidence" in parsed).toBe(false);
  });
});
