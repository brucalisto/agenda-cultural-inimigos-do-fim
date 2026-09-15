import { describe, expect, test } from "bun:test";

import {
  expandPublishedRecurringRows,
  parseRecurrenceKeywords,
  prepareRecurringItemsForReview,
} from "@/lib/recurrence.server";

const baseItem = {
  title: "Oficina semanal",
  category: "Oficina",
  summary: "Atividade semanal",
  full_description: "Oficina toda segunda-feira às 19h.",
  event_date: "2026-09-14T19:00:00-03:00",
  time_was_informed: true,
  location: "Centro Cultural",
  city: "Caraguatatuba",
  price: null,
  contact_name: null,
  contact_phone: null,
  contact_instagram: "@fundacc",
  source_url: "https://instagram.com/fundacc",
  keywords: ["recurrence:weekly", "weekdays:1", "time:19:00", "start:2026-09-14", "end:2026-09-28"],
  missing_fields: [],
  warnings: [],
  confidence_score: 0.95,
};

describe("recurrence", () => {
  test("lê marcadores semanais e remove duplicatas de weekday", () => {
    expect(parseRecurrenceKeywords(["recurrence:weekly", "weekdays:1,1,3", "time:19:00"])).toEqual({
      frequency: "weekly",
      weekdays: [1, 3],
      time: "19:00",
      startDate: null,
      endDate: null,
    });
  });

  test("mantém um único registro-base durante a revisão", () => {
    const prepared = prepareRecurringItemsForReview([baseItem], { now: new Date("2026-09-15T12:00:00Z") });
    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.keywords).toEqual([]);
    expect((prepared[0]?.extracted_data as { recurrence?: { endDate?: string } }).recurrence?.endDate).toBe("2026-09-28");
  });

  test("expande somente ocorrências futuras e preserva 19h em São Paulo", () => {
    const recurrence = {
      frequency: "weekly",
      weekdays: [1],
      time: "19:00",
      startDate: "2026-09-14",
      endDate: "2026-09-28",
      endDateSource: "source",
    };
    const rows = expandPublishedRecurringRows([
      {
        id: "base-1",
        title: "Oficina semanal",
        event_date: "2026-09-14T22:00:00.000Z",
        source_url: "https://example.com/evento",
        location: "Centro Cultural",
        extracted_data: { recurrence },
      },
      {
        id: "legacy-duplicate",
        title: "Oficina semanal",
        event_date: "2026-09-21T22:00:00.000Z",
        source_url: "https://example.com/evento",
        location: "Centro Cultural",
        extracted_data: { recurrence },
      },
    ], { now: new Date("2026-09-15T12:00:00Z") });

    expect(rows.map((row) => row.recurrence_date)).toEqual(["2026-09-21", "2026-09-28"]);
    expect(rows[0]?.event_date).toBe("2026-09-21T22:00:00.000Z");
    expect(rows[0]?.source_record_id).toBe("base-1");
  });
});
