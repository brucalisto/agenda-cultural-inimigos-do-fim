-- Segurança de mídia da comunidade.
-- Mantém uploads de usuários confinados ao próprio prefixo e restringe MIME/tamanho no bucket.

-- 1) Reafirma o contrato do bucket interno de imagens dos eventos.
-- O serviço usa service-role para escrita; o bucket permanece público somente para leitura das capas.
update storage.buckets
set
  public = true,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'event-images';

-- 2) Imagens públicas da comunidade: avatar, capa, galeria e imagens de posts/listagens.
-- SVG/HTML ficam deliberadamente fora da allowlist para evitar conteúdo ativo no navegador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-public-images',
  'community-public-images',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3) Anexos privados/reservados da comunidade.
-- Serve de base para documentos, áudios e vídeos de projetos/chat sem torná-los públicos por URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-private-files',
  'community-private-files',
  false,
  26214400,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'audio/mpeg',
    'audio/ogg',
    'audio/mp4',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Convenção obrigatória para uploads de membros:
--   <auth.uid()>/<arquivo>
-- Assim, mesmo usando diretamente a API do Storage, um usuário não consegue escrever no diretório de outro.

drop policy if exists "Community members upload own public images" on storage.objects;
create policy "Community members upload own public images"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'community-public-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Community members update own public images" on storage.objects;
create policy "Community members update own public images"
on storage.objects
for update to authenticated
using (
  bucket_id = 'community-public-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'community-public-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Community members delete own public images" on storage.objects;
create policy "Community members delete own public images"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'community-public-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Community members list own public images" on storage.objects;
create policy "Community members list own public images"
on storage.objects
for select to authenticated
using (
  bucket_id = 'community-public-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.has_role(auth.uid(), 'admin')
    or private.has_role(auth.uid(), 'revisor')
  )
);

drop policy if exists "Community members upload own private files" on storage.objects;
create policy "Community members upload own private files"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'community-private-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Community members read own private files" on storage.objects;
create policy "Community members read own private files"
on storage.objects
for select to authenticated
using (
  bucket_id = 'community-private-files'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.has_role(auth.uid(), 'admin')
    or private.has_role(auth.uid(), 'revisor')
  )
);

drop policy if exists "Community members update own private files" on storage.objects;
create policy "Community members update own private files"
on storage.objects
for update to authenticated
using (
  bucket_id = 'community-private-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'community-private-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Community members delete own private files" on storage.objects;
create policy "Community members delete own private files"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'community-private-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
