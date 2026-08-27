create index if not exists interpreted_contents_feed_external_key_idx
  on public.interpreted_contents ((extracted_data ->> 'feedExternalKey'))
  where extracted_data ? 'feedExternalKey';

create index if not exists interpreted_contents_feed_source_id_idx
  on public.interpreted_contents ((extracted_data ->> 'feedSourceId'))
  where extracted_data ? 'feedSourceId';

create index if not exists publication_destinations_feed_source_idx
  on public.publication_destinations (provider, enabled)
  where provider = 'feed_source';
