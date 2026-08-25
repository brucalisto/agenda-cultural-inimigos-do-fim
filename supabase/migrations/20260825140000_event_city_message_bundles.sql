ALTER TABLE public.interpreted_contents
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS bundled_into_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_recent_sender_idx
  ON public.whatsapp_messages (group_id, sender_external_id, occurred_at DESC);

