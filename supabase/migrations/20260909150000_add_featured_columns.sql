ALTER TABLE public.interpreted_contents
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS featured_ends_at timestamptz;

NOTIFY pgrst, 'reload schema';
