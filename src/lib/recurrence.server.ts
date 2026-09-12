import type { InterpretedContentResponse } from "@/lib/gemini/schema";

type RecurrenceMeta = {
  frequency: "weekly";
  weekdays: number[];
  time: string | null;
  startDate: string | null;
  endDate: string | null;
  endDateSource: "source" | "fundacc-semester" | null;
};

type ExpandOptions = {
  sourceName: string;
  sourceUrl: string;
  now?: Date;
};

export type RecurringExpandedItem = InterpretedContentResponse & {
  recurrenceMeta?: RecurrenceMeta;
  recurrenceIndex?: number;
  recurrenceDate?: string;
};

const RECURRENCE_PREFIXES = ["recurrence:", "weekdays:", "time:", "start:", "end:"];
const RECURRENT_ACTIVITY_RE = /\b(?:oficina|curso|aula|aulas|turma|turmas|atividade permanente|encontro semanal|treino|ensaio)\b/i;
const RECURRENCE_CUE_RE = /\b(?:toda|todo|todas|todos)\s+(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)s?\b|\b(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:s|-feiras?)?\b.*\b(?:semanal|toda semana|todas as semanas)\b|\b(?:semanalmente|toda semana|todas as semanas)\b/i;

function dateInSaoPaulo(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseIsoDay(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || null;
}

function validDay(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}

function endOfSemester(day: string) {
  const [year, month] = day.split("-").map(Number);
  return month <= 6 ? `${year}-06-30` : `${year}-12-31`;
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function weekday(day: string) {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

function toEventIso(day: string, time: string) {
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return new Date(`${day}T${normalizedTime}:00-03:00`).toISOString();
}

function parseMarker(keywords: string[], prefix: string) {
  return keywords.find((keyword) => keyword.toLowerCase().startsWith(prefix))?.slice(prefix.length).trim() || null;
}

export function parseRecurrenceKeywords(keywords: string[] | null | undefined) {
  const values = (keywords || []).map((value) => value.trim()).filter(Boolean);
  if (parseMarker(values, "recurrence:")?.toLowerCase() !== "weekly") return null;

  const weekdays = (parseMarker(values, "weekdays:") || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  const time = parseMarker(values, "time:");
  const startDate = validDay(parseMarker(values, "start:"));
  const endDate = validDay(parseMarker(values, "end:"));

  return {
    frequency: "weekly" as const,
    weekdays: [...new Set(weekdays)],
    time: time && /^\d{2}:\d{2}$/.test(time) ? time : null,
    startDate,
    endDate,
  };
}

export function sanitizeRecurrenceKeywords(keywords: string[] | null | undefined) {
  return (keywords || []).filter(
    (keyword) => !RECURRENCE_PREFIXES.some((prefix) => keyword.toLowerCase().startsWith(prefix)),
  );
}

export function looksLikeRecurringActivity(text: string) {
  return RECURRENT_ACTIVITY_RE.test(text) && (RECURRENCE_CUE_RE.test(text) || /\b(?:oficina|curso|aula|turma)\b/i.test(text));
}

export function hasUsableRecurrence(item: InterpretedContentResponse) {
  const recurrence = parseRecurrenceKeywords(item.keywords);
  return Boolean(recurrence?.weekdays.length && recurrence.time);
}

function isFundacc(options: ExpandOptions) {
  return /fundacc/i.test(`${options.sourceName} ${options.sourceUrl}`);
}

function recurringActivityItem(item: InterpretedContentResponse) {
  return RECURRENT_ACTIVITY_RE.test(
    `${item.title || ""} ${item.summary || ""} ${item.full_description || ""} ${(item.keywords || []).join(" ")}`,
  );
}

export function expandRecurringItems(
  items: InterpretedContentResponse[],
  options: ExpandOptions,
): RecurringExpandedItem[] {
  const today = dateInSaoPaulo(options.now || new Date());
  const expanded: RecurringExpandedItem[] = [];

  for (const item of items) {
    const recurrence = parseRecurrenceKeywords(item.keywords);
    const cleanKeywords = sanitizeRecurrenceKeywords(item.keywords);
    if (!recurrence) {
      expanded.push({ ...item, keywords: cleanKeywords });
      continue;
    }

    if (!recurrence.weekdays.length || !recurrence.time) {
      expanded.push({
        ...item,
        keywords: cleanKeywords,
        missing_fields: [...new Set([...(item.missing_fields || []), "recurrence_schedule"])],
        warnings: [
          ...(item.warnings || []),
          "Recorrência detectada, mas dias da semana ou horário não puderam ser confirmados.",
        ].slice(0, 4),
        confidence_score: Math.min(item.confidence_score, 0.74),
      });
      continue;
    }

    const firstExplicitDate = parseIsoDay(item.event_date);
    const startDate = recurrence.startDate || firstExplicitDate || today;
    let endDate = recurrence.endDate;
    let endDateSource: RecurrenceMeta["endDateSource"] = endDate ? "source" : null;

    if (!endDate && isFundacc(options) && recurringActivityItem(item)) {
      endDate = endOfSemester(startDate);
      endDateSource = "fundacc-semester";
    }

    if (!endDate) {
      expanded.push({
        ...item,
        keywords: cleanKeywords,
        missing_fields: [...new Set([...(item.missing_fields || []), "recurrence_end_date"])],
        warnings: [
          ...(item.warnings || []),
          "Recorrência semanal confirmada, mas a fonte não informa término; mantida para revisão sem expansão automática.",
        ].slice(0, 4),
        confidence_score: Math.min(item.confidence_score, 0.82),
        recurrenceMeta: {
          frequency: "weekly",
          weekdays: recurrence.weekdays,
          time: recurrence.time,
          startDate,
          endDate: null,
          endDateSource: null,
        },
      });
      continue;
    }

    if (endDate < startDate) {
      expanded.push({
        ...item,
        keywords: cleanKeywords,
        warnings: [...(item.warnings || []), "Período de recorrência inválido: término anterior ao início."].slice(0, 4),
        confidence_score: Math.min(item.confidence_score, 0.65),
      });
      continue;
    }

    const recurrenceMeta: RecurrenceMeta = {
      frequency: "weekly",
      weekdays: recurrence.weekdays,
      time: recurrence.time,
      startDate,
      endDate,
      endDateSource,
    };

    let cursor = startDate;
    let occurrence = 0;
    while (cursor <= endDate && occurrence < 100) {
      if (recurrence.weekdays.includes(weekday(cursor)) && cursor >= today) {
        const recurrenceDate = toEventIso(cursor, recurrence.time);
        expanded.push({
          ...item,
          event_date: recurrenceDate,
          keywords: cleanKeywords,
          missing_fields: (item.missing_fields || []).filter(
            (field) => !["event_date", "recurrence_schedule", "recurrence_end_date"].includes(field),
          ),
          recurrenceMeta,
          recurrenceIndex: occurrence,
          recurrenceDate,
        });
        occurrence += 1;
      }
      cursor = addDays(cursor, 1);
    }

    if (occurrence === 0) {
      expanded.push({
        ...item,
        keywords: cleanKeywords,
        warnings: [...(item.warnings || []), "A recorrência informada não possui ocorrências futuras dentro do período detectado."].slice(0, 4),
        recurrenceMeta,
      });
    }
  }

  return expanded;
}
