import { describe, expect, test } from "bun:test";

import { buildPublicAgendaEvents } from "@/lib/public-events";
import { REVIEW_STATUS } from "@/lib/workflow-status";

describe("fluxo de publicação até a agenda pública", () => {
  test("um evento interpretado não aparece antes da revisão e aparece após publicação", () => {
    const interpreted = {
      id: "event-review-1",
      review_status: REVIEW_STATUS.NEEDS_REVIEW,
      title: "Sarau de poesia",
      category: "Literatura",
      summary: "Encontro cultural aberto ao público.",
      event_date: "2026-09-20T03:00:00.000Z",
      time_was_informed: false,
      location: "Centro Cultural",
      city: "Caraguatatuba",
      price: "0",
      source_url: "https://example.com/sarau",
      keywords: ["poesia", "sarau"],
      extracted_data: { time_was_informed: false },
    };

    // Interpretação/revisão: ainda não pode vazar para a agenda pública.
    expect(buildPublicAgendaEvents([interpreted])).toHaveLength(0);

    // A ação de moderação muda o mesmo registro para o estado canônico publicado.
    const published = {
      ...interpreted,
      review_status: REVIEW_STATUS.PUBLISHED,
      reviewed_at: "2026-09-15T22:30:00.000Z",
    };

    const agenda = buildPublicAgendaEvents([published]);
    expect(agenda).toHaveLength(1);
    expect(agenda[0]).toMatchObject({
      id: "event-review-1",
      title: "Sarau de poesia",
      event_date: "2026-09-20",
      location: "Centro Cultural",
      city: "Caraguatatuba",
      price_kind: "free",
      price_label: "Gratuito",
    });
  });

  test("mantém horário explícito e exclui estados terminais que não são publicação", () => {
    const base = {
      title: "Show no coreto",
      event_date: "2026-09-26T22:00:00.000Z",
      time_was_informed: true,
      location: "Praça Central",
      city: "Caraguatatuba",
      price: "R$ 20",
      keywords: ["música"],
      extracted_data: { time_was_informed: true },
    };

    const agenda = buildPublicAgendaEvents([
      { ...base, id: "published-1", review_status: REVIEW_STATUS.PUBLISHED },
      { ...base, id: "ignored-1", review_status: REVIEW_STATUS.IGNORED },
      { ...base, id: "disabled-1", review_status: REVIEW_STATUS.DISABLED },
    ]);

    expect(agenda).toHaveLength(1);
    expect(agenda[0]).toMatchObject({
      id: "published-1",
      event_date: "2026-09-26T22:00:00.000Z",
      price_kind: "paid",
      price_label: "R$ 20",
    });
  });
});
