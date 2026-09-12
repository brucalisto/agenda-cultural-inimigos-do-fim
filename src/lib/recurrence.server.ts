import type { InterpretedContentResponse } from "@/lib/gemini/schema";

export type RecurrenceMeta = {
  frequency: "weekly";
  weekdays: number[];
  time: string | null;
  startDate: string | null;
  endDate: string | null;
  endDateSource: "source" | "fundacc-semester" | null;
};

type RecurrenceOptions = {
  sourceName?: string;
  sourceUrl?: string;
  now?: Date;
};

export type RecurringPreparedItem = InterpretedContentResponse & {
  extracted_data?: Record<string, unknown>;
};

export type PublishedRecurrenceRow = {
  id: string;
  title?: string | null;
  event_date?: string | null;
  source_url?: string | null;
  location?: string | null;
  keywords?: string[] | null;
  extracted_data?: unknown;
  [key: string]: unknown;
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
  return value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || null;
}

function validDay(value: string | null | undefined) {
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
  return new Date(`${day}T${time}:00-03:00`).toISOString();
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

  return {
    frequency: "weekly" as const,
    weekdays: [...new Set(weekdays)],
    time: time && /^\d{2}:\d{2}$/.test(time) ? time : null,
    startDate: validDay(parseMarker(values, "start:")),
    endDate: validDay(parseMarker(values, "end:")),
  };
}

export function sanitizeRecurrenceKeywords(keywords: string[] | null | undefined) {
  return (keywords || []).filter(
    (keyword) => !RECURRENCE_PREFIXES.some((prefix) => keyword.toLowerCase().startsWith(prefix)),
  );
}

export function looksLikeRecurringActivity(text: string) {
  return RECURRENT_ACTIVITY_RE.test(text) &&
    (RECURRENCE_CUE_RE.test(text) || /\b(?:oficina|curso|aula|turma)\b/i.test(text));
}

function isFundacc(options: RecurrenceOptions, item: InterpretedContentResponse) {
  const itemEvidence = `${item.title || ""} ${item.summary || ""} ${item.full_description || ""} ${item.contact_instagram || ""}`;
  return /fundacc/i.test(`${options.sourceName || ""} ${options.sourceUrl || ""} ${itemEvidence}`);
}

function recurringActivityItem(item: InterpretedContentResponse) {
  return RECURRENT_ACTIVITY_RE.test(
    `${item.title || ""} ${item.summary || ""} ${item.full_description || ""} ${(item.keywords || []).join(" ")}`,
  );
}

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Prepara a recorrência para revisão, mas NÃO gera uma linha por ocorrência.
 * A revisão e a área de Publicados trabalham com um registro-base; a agenda pública
 * expande as datas somente depois da aprovação.
 */
export function prepareRecurringItemsForReview(
  items: InterpretedContentResponse[],
  options: RecurrenceOptions = {},
): RecurringPreparedItem[] {
  const today = dateInSaoPaulo(options.now || new Date());

  return items.map((item) => {
    const parsed = parseRecurrenceKeywords(item.keywords);
    if (!parsed) return item;

    const firstExplicitDate = parseIsoDay(item.event_date);
    const startDate = parsed.startDate || firstExplicitDate || today;
    let endDate = parsed.endDate;
    let endDateSource: RecurrenceMeta["endDateSource"] = endDate ? "source" : null;

    if (!endDate && isFundacc(options, item) && recurringActivityItem(item)) {
      endDate = endOfSemester(startDate);
      endDateSource = "fundacc-semester";
    }

    const recurrence: RecurrenceMeta = {
      frequency: "weekly",
      weekdays: parsed.weekdays,
      time: parsed.time,
      startDate,
      endDate,
      endDateSource,
    };

    const completeSchedule = Boolean(recurrence.weekdays.length && recurrence.time);
    const missing = new Set(item.missing_fields || []);
    const warnings = [...(item.warnings || [])];
    let confidence = item.confidence_score;

    if (!completeSchedule) {
      missing.add("recurrence_schedule");
      warnings.push("Recorrência detectada, mas dias da semana ou horário não puderam ser confirmados.");
      confidence = Math.min(confidence, 0.74);
    } else {
      missing.delete("recurrence_schedule");
    }

    if (!endDate) {
      missing.add("recurrence_end_date");
      warnings.push("Recorrência confirmada, mas a fonte não informa término; exige revisão antes da publicação.");
      confidence = Math.min(confidence, 0.82);
    } else {
      missing.delete("recurrence_end_date");
    }

    if (endDate && endDate < startDate) {
      warnings.push("Período de recorrência inválido: término anterior ao início.");
      confidence = Math.min(confidence, 0.65);
    }

    return {
      ...item,
      keywords: sanitizeRecurrenceKeywords(item.keywords),
      missing_fields: [...missing].slice(0, 6),
      warnings: [...new Set(warnings)].slice(0, 4),
      confidence_score: confidence,
      extracted_data: {
        ...objectRecord((item as { extracted_data?: unknown }).extracted_data),
        recurrence,
      },
    };
  });
}

function recurrenceFromExtracted(value: unknown): RecurrenceMeta | null {
  const record = objectRecord(value);
  const raw = objectRecord(record.recurrence);
  if (raw.frequency !== "weekly") return null;

  const weekdays = Array.isArray(raw.weekdays)
    ? raw.weekdays
        .map(Number)
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : [];
  const time = typeof raw.time === "string" && /^\d{2}:\d{2}$/.test(raw.time) ? raw.time : null;
  const startDate = validDay(typeof raw.startDate === "string" ? raw.startDate : null);
  const endDate = validDay(typeof raw.endDate === "string" ? raw.endDate : null);
  const endDateSource =
    raw.endDateSource === "source" || raw.endDateSource === "fundacc-semester"
      ? raw.endDateSource
      : null;

  return {
    frequency: "weekly",
    weekdays: [...new Set(weekdays)],
    time,
    startDate,
    endDate,
    endDateSource,
  };
}

function recurrenceSeriesKey(row: PublishedRecurrenceRow, recurrence: RecurrenceMeta) {
  return [
    row.source_url || "",
    row.title || "",
    row.location || "",
    recurrence.weekdays.join(","),
    recurrence.time || "",
    recurrence.startDate || "",
    recurrence.endDate || "",
  ].join("|");
}

/**
 * Expande registros recorrentes aprovados somente para a resposta da agenda pública.
 * Também colapsa registros legados que já tinham sido materializados uma vez por data,
 * evitando duplicidade depois da nova arquitetura agrupada.
 */
export function expandPublishedRecurringRows<T extends PublishedRecurrenceRow>(
  rows: T[],
  options: { now?: Date } = {},
): Array<T & { source_record_id?: string; recurrence_date?: string }> {
  const today = dateInSaoPaulo(options.now || new Date());
  const output: Array<T & { source_record_id?: string; recurrence_date?: string }> = [];
  const expandedSeries = new Set<string>();

  for (const row of rows) {
    const recurrence = recurrenceFromExtracted(row.extracted_data);
    if (!recurrence) {
      if (row.event_date) output.push(row);
      continue;
    }

    const key = recurrenceSeriesKey(row, recurrence);
    if (expandedSeries.has(key)) continue;
    expandedSeries.add(key);

    const startDate = recurrence.startDate || parseIsoDay(row.event_date) || today;
    const endDate = recurrence.endDate;
    if (!recurrence.weekdays.length || !recurrence.time || !endDate || endDate < startDate) {
      if (row.event_date) output.push(row);
      continue;
    }

    let cursor = startDate;
    let index = 0;
    while (cursor <= endDate && index < 120) {
      if (cursor >= today && recurrence.weekdays.includes(weekday(cursor))) {
        output.push({
          ...row,
          id: `${row.id}::${cursor}`,
          source_record_id: row.id,
          recurrence_date: cursor,
          event_date: toEventIso(cursor, recurrence.time),
        });
        index += 1;
      }
      cursor = addDays(cursor, 1);
    }
  }

  return output.sort((a, b) => (a.event_date || "").localeCompare(b.event_date || ""));
}
