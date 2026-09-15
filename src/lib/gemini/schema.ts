import { z } from "zod";
import { EVIDENCE_FIELDS, EVIDENCE_SOURCES } from "@/lib/field-evidence";

/**
 * A agenda trabalha com o horário civil do evento em São Paulo/Caraguatatuba.
 * Modelos de IA frequentemente acrescentam `Z` apenas para "parecer ISO", sem
 * realmente converter o horário informado na fonte para UTC. Isso fazia, por
 * exemplo, um evento anunciado às 19h ser salvo como 19:00Z e exibido às 16h
 * no navegador (UTC-3).
 *
 * O contrato da extração por IA é preservar o relógio que aparece na fonte e
 * associá-lo explicitamente ao fuso da agenda. Quando a fonte informa somente
 * a data, persistimos 00:00 no fuso da agenda apenas como representação técnica
 * e carregamos `time_was_informed = false` para nunca exibir esse horário como
 * se tivesse vindo da divulgação.
 */
export const AGENDA_TIME_ZONE = "America/Sao_Paulo";
export const AGENDA_UTC_OFFSET = "-03:00";

function aiDateHasExplicitTime(value: string | null) {
  return Boolean(value && /[T ]\d{2}:\d{2}/.test(value.trim()));
}

export function normalizeAiEventDate(value: string | null) {
  if (value == null) return null;
  const input = value.trim();
  if (!input) return null;

  // Data sem horário: ancora o dia civil em São Paulo. Salvar apenas YYYY-MM-DD
  // em uma coluna timestamptz faria o PostgreSQL interpretar meia-noite em UTC
  // e poderia deslocar o evento para o dia anterior na agenda.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return `${input}T00:00:00${AGENDA_UTC_OFFSET}`;
  }

  const match = input.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})?$/i,
  );
  if (!match) return input;

  const [, day, hoursAndMinutes, seconds = "00", zone] = match;

  // A IA deve devolver o horário local exibido na fonte. Se omitiu o fuso ou
  // usou UTC/Z como marcador genérico, atribuímos o fuso correto da agenda sem
  // alterar o relógio informado (19h continua 19h).
  if (!zone || zone.toUpperCase() === "Z" || zone === "+00:00") {
    return `${day}T${hoursAndMinutes}:${seconds}${AGENDA_UTC_OFFSET}`;
  }

  return input;
}

const FieldEvidenceSchema = z.object({
  field: z.enum(EVIDENCE_FIELDS),
  source: z.enum(EVIDENCE_SOURCES),
  source_ref: z.string().min(1).max(100),
  excerpt: z.string().max(180).nullable(),
});

const InterpretedContentBaseSchema = z.object({
  title: z.string().nullable(),
  category: z.string().nullable(),
  summary: z.string().nullable(),
  full_description: z.string().nullable(),
  event_date: z.string().nullable(),
  time_was_informed: z.boolean().optional(),
  location: z.string().nullable(),
  city: z.string().nullable(),
  price: z.number().nullable(),
  contact_name: z.string().nullable(),
  contact_phone: z.string().nullable(),
  contact_instagram: z.string().nullable(),
  source_url: z.string().nullable(),
  keywords: z.array(z.string()).default([]),
  missing_fields: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  evidence: z.array(FieldEvidenceSchema).max(16).default([]),
  confidence_score: z.number().min(0).max(1),
});

export const InterpretedContentSchema = InterpretedContentBaseSchema.transform((value) => ({
  ...value,
  event_date: normalizeAiEventDate(value.event_date),
  // Mantém compatibilidade com provedores que ainda não devolvem o novo campo:
  // datetime explícito => havia horário; YYYY-MM-DD => somente data.
  time_was_informed: value.time_was_informed ?? aiDateHasExplicitTime(value.event_date),
}));

export type InterpretedContentResponse = z.infer<typeof InterpretedContentSchema>;

export const InterpretedContentsSchema = z.object({
  items: z.array(InterpretedContentSchema).min(1),
});

export type InterpretedContentsResponse = z.infer<typeof InterpretedContentsSchema>;
