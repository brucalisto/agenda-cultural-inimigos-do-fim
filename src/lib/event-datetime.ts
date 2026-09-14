export const EVENT_TIME_ZONE = "America/Sao_Paulo";
export const EVENT_TIME_OFFSET = "-03:00";

function asDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parts(value: string | Date) {
  const date = asDate(value);
  if (!date) return null;
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    values.find((part) => part.type === type)?.value || "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

export function eventDateKey(value: string | Date) {
  const valueParts = parts(value);
  if (!valueParts) return "";
  return `${valueParts.year}-${valueParts.month}-${valueParts.day}`;
}

export function todayEventDateKey() {
  return eventDateKey(new Date());
}

export function formatEventTime(value: string | Date) {
  const date = asDate(value);
  if (!date) return "Horário não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: EVENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatEventDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = asDate(value);
  if (!date) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: EVENT_TIME_ZONE,
    ...options,
  }).format(date);
}

export function formatEventDateTime(value: string | Date) {
  const date = asDate(value);
  if (!date) return "Data e horário não informados";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: EVENT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function eventDateTimeInputValue(value: string | null | undefined) {
  if (!value) return "";
  const valueParts = parts(value);
  if (!valueParts) return "";
  return `${valueParts.year}-${valueParts.month}-${valueParts.day}T${valueParts.hour}:${valueParts.minute}`;
}

export function eventDateTimeInputToIso(value: string) {
  if (!value) return null;
  // Eventos desta agenda usam o horário civil de São Paulo/Caraguatatuba.
  // O offset explícito evita que `datetime-local` seja reinterpretado conforme
  // o fuso do computador de quem estiver administrando a plataforma.
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? `${value}:00${EVENT_TIME_OFFSET}`
    : `${value}${EVENT_TIME_OFFSET}`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
