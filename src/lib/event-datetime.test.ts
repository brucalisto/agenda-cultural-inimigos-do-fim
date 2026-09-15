import { describe, expect, test } from "bun:test";

import {
  eventDateKey,
  eventDateTimeInputToIso,
  eventDateTimeInputValue,
  formatEventTime,
} from "@/lib/event-datetime";

describe("event-datetime", () => {
  test("preserva o horário civil de São Paulo na edição", () => {
    expect(eventDateTimeInputValue("2026-09-27T22:00:00.000Z")).toBe("2026-09-27T19:00");
    expect(eventDateTimeInputToIso("2026-09-27T19:00")).toBe("2026-09-27T22:00:00.000Z");
  });

  test("formata o horário do evento no fuso canônico", () => {
    expect(formatEventTime("2026-09-27T22:00:00.000Z")).toBe("19:00");
  });

  test("não desloca datas sem horário", () => {
    expect(eventDateKey("2026-09-27")).toBe("2026-09-27");
    expect(formatEventTime("2026-09-27")).toBe("Horário não informado");
  });
});
