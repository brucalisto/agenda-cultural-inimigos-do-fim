import { z } from "zod";

export const InterpretedContentSchema = z.object({
  title: z.string().nullable(),
  category: z.string().nullable(),
  summary: z.string().nullable(),
  full_description: z.string().nullable(),
  event_date: z.string().nullable(), // ISO String validation handled if needed
  location: z.string().nullable(),
  city: z.string().nullable(),
  price: z.number().nullable(),
  contact_name: z.string().nullable(),
  contact_phone: z.string().nullable(),
  source_url: z.string().nullable(),
  keywords: z.array(z.string()).default([]),
  missing_fields: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  confidence_score: z.number().min(0).max(1),
});

export type InterpretedContentResponse = z.infer<typeof InterpretedContentSchema>;
