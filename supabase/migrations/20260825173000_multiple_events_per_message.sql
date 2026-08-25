ALTER TABLE public.interpreted_contents
  DROP CONSTRAINT IF EXISTS interpreted_contents_message_id_key;

ALTER TABLE public.interpreted_contents
  ADD COLUMN IF NOT EXISTS event_sequence integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS interpreted_contents_message_event_sequence_key
  ON public.interpreted_contents (message_id, event_sequence);

CREATE INDEX IF NOT EXISTS interpreted_contents_event_date_idx
  ON public.interpreted_contents (event_date);
