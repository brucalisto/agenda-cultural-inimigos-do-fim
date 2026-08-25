ALTER TABLE public.interpreted_contents
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS event_sequence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_instagram text;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS bundled_into_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL;
