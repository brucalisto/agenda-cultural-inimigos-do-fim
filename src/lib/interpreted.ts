import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type InterpretedContent = {
  id: string;
  message_id: string;
  title: string | null;
  category: string | null;
  summary: string | null;
  full_description: string | null;
  event_date: string | null;
  location: string | null;
  city: string | null;
  price: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  source_url: string | null;
  keywords: string[] | null;
  extracted_data: Json;
  missing_fields: string[] | null;
  warnings: string[] | null;
  confidence_score: number | null;
  model_used: string | null;
  prompt_version: string | null;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  whatsapp_messages?: {
    text_content: string | null;
    sender_name: string | null;
    occurred_at: string;
    whatsapp_groups?: {
      nome: string;
    } | null;
    message_media?: Array<{
      media_type: string;
      original_filename: string;
      storage_path: string | null;
    }>;
    extracted_links?: Array<{
      original_url: string;
      page_title: string | null;
    }>;
    raw_payload?: Json;
  } | null;
};

export async function getInterpretedContents() {
  const { data, error } = await supabase
    .from("interpreted_contents")
    .select(
      `
      *,
      whatsapp_messages (
        text_content,
        sender_name,
        occurred_at,
        whatsapp_groups (
          nome
        )
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as InterpretedContent[];
}

export async function getInterpretedContentById(id: string) {
  const { data, error } = await supabase
    .from("interpreted_contents")
    .select(
      `
      *,
      whatsapp_messages (
        text_content,
        sender_name,
        occurred_at,
        raw_payload,
        whatsapp_groups (
          nome
        ),
        message_media (
          media_type,
          original_filename,
          storage_path
        ),
        extracted_links (
          original_url,
          page_title
        )
      )
    `,
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as InterpretedContent;
}

export async function updateInterpretedContent(
  id: string,
  updates: Partial<Omit<InterpretedContent, "whatsapp_messages">>,
) {
  const { data, error } = await supabase
    .from("interpreted_contents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
