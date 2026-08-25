import { z } from "zod";

export const BaileysWebhookSchema = z.object({
  eventId: z.string(),
  receivedAt: z.string(),
  messageTimestamp: z.union([z.string(), z.number()]),
  groupId: z.string().min(1),
  groupName: z.string().optional().default("Grupo detectado"),
  messageId: z.string().min(1),
  senderId: z.string().min(1),
  senderName: z.string().nullable().optional(),
  fromMe: z.boolean().optional().default(false),
  contentType: z.string().optional().default("unknown"),
  text: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  links: z.array(z.string().url()).optional().default([]),
  linkPreview: z
    .object({
      title: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      jpegThumbnailBase64: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  media: z
    .object({
      fileName: z.string(),
      mimeType: z.string(),
      relativePath: z.string(),
      size: z.number().nonnegative(),
    })
    .nullable()
    .optional(),
});
export type BaileysWebhook = z.infer<typeof BaileysWebhookSchema>;
export const parseBaileysWebhook = (value: unknown) => BaileysWebhookSchema.parse(value);
export const isNonEditorialContentType = (contentType: string) => contentType === "reactionMessage";
