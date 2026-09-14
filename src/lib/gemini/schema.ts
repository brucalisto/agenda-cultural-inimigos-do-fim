import { z } from "zod";

/**
 * A agenda trabalha com o horário civil do evento em São Paulo/Caraguatatuba.
 * Modelos de IA frequentemente acrescentam `Z` apenas para "parecer ISO", sem
 * realmente converter o horário informado na fonte para UTC. Isso fazia, por
 * exemplo, um evento anunciado às 19h ser salvo como 19:00Z e exibido às 16h
 * no navegador (UTC-3).
 *
 * O contrato da extração por IA é preservar o relógio que aparece na fonte e
 * associá-lo explicitamente ao fuso da agenda. Datas geradas depois pela
 * aplicação (como recorrências) não passam por este schema e continuam usando
 * instantes UTC normais.
 */
export const AGENDA_TIME_ZONE = "America/Sao_Paulo";
export const AGENDA_UTC_OFFSET = "-03:00";

export function normalizeAiEventDate(value: string | null) {
  if (value == null) return null;
  const input = value.trim();
  if (!input) return null;

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

export const InterpretedContentSchema = z.object({
  title: z.string().nullable(),
  category: z.string().nullable(),
  summary: z.string().nullable(),
  full_description: z.string().nullable(),
  event_date: z.string().nullable().transform(normalizeAiEventDate),
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
  confidence_score: z.number().min(0).max(1),
});

export type InterpretedContentResponse = z.infer<typeof InterpretedContentSchema>;

export const InterpretedContentsSchema = z.object({
  items: z.array(InterpretedContentSchema).min(1),
});

export type InterpretedContentsResponse = z.infer<typeof InterpretedContentsSchema>;
