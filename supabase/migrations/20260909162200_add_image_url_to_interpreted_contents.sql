-- Keep the database schema aligned with the processing pipeline.
-- The app stores the original event image URL on interpreted_contents.
ALTER TABLE public.interpreted_contents
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.interpreted_contents.image_url IS
  'Public URL of the original event image stored in Supabase Storage.';

-- Ask PostgREST to refresh its schema cache after the migration is applied.
NOTIFY pgrst, 'reload schema';
