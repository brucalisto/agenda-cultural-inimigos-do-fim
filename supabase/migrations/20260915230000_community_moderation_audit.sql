-- Trilha de auditoria da moderação da comunidade.
-- Registra somente metadados de decisão/estado; não copia conteúdo de posts, mensagens ou perfis.

create table if not exists public.community_moderation_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in (
    'community_event_submission',
    'marketplace_listing',
    'community_profile',
    'community_post',
    'community_space',
    'chat_message'
  )),
  entity_id uuid,
  action text not null,
  changed_fields text[] not null default '{}',
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

alter table public.community_moderation_audit enable row level security;

-- O histórico é somente leitura para admin/revisor. Não existe policy de insert/update/delete
-- para clientes; as entradas são criadas exclusivamente pelo trigger SECURITY DEFINER.
drop policy if exists "Moderators read community audit" on public.community_moderation_audit;
create policy "Moderators read community audit"
on public.community_moderation_audit
for select to authenticated
using (
  private.has_role(auth.uid(), 'admin')
  or private.has_role(auth.uid(), 'revisor')
);

revoke insert, update, delete on table public.community_moderation_audit from anon, authenticated;
grant select on table public.community_moderation_audit to authenticated;

create index if not exists community_moderation_audit_created_idx
  on public.community_moderation_audit (created_at desc);
create index if not exists community_moderation_audit_actor_idx
  on public.community_moderation_audit (actor_id, created_at desc);
create index if not exists community_moderation_audit_entity_idx
  on public.community_moderation_audit (entity_type, entity_id, created_at desc);

create or replace function public.audit_community_moderation_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  actor uuid := auth.uid();
  old_row jsonb := '{}'::jsonb;
  new_row jsonb := '{}'::jsonb;
  old_state jsonb := '{}'::jsonb;
  new_state jsonb := '{}'::jsonb;
  changed text[] := '{}'::text[];
  entity_kind text;
  entity_uuid uuid;
  action_name text := lower(TG_OP);
  audit_note text;
begin
  -- Escritas internas sem usuário e ações de membros comuns não pertencem à trilha de moderação.
  if actor is null
     or not (
       private.has_role(actor, 'admin')
       or private.has_role(actor, 'revisor')
     ) then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;

  if TG_OP in ('UPDATE', 'DELETE') then old_row := to_jsonb(OLD); end if;
  if TG_OP in ('UPDATE', 'INSERT') then new_row := to_jsonb(NEW); end if;

  entity_uuid := nullif(coalesce(new_row->>'id', old_row->>'id'), '')::uuid;

  case TG_TABLE_NAME
    when 'community_event_submissions' then
      entity_kind := 'community_event_submission';
      old_state := jsonb_build_object(
        'status', old_row->'status',
        'duplicate_of', old_row->'duplicate_of',
        'published_event_id', old_row->'published_event_id',
        'moderation_notes', old_row->'moderation_notes'
      );
      new_state := jsonb_build_object(
        'status', new_row->'status',
        'duplicate_of', new_row->'duplicate_of',
        'published_event_id', new_row->'published_event_id',
        'moderation_notes', new_row->'moderation_notes'
      );
    when 'marketplace_listings' then
      entity_kind := 'marketplace_listing';
      old_state := jsonb_build_object(
        'status', old_row->'status',
        'moderation_notes', old_row->'moderation_notes'
      );
      new_state := jsonb_build_object(
        'status', new_row->'status',
        'moderation_notes', new_row->'moderation_notes'
      );
    when 'community_profiles' then
      entity_kind := 'community_profile';
      old_state := jsonb_build_object(
        'verified', old_row->'verified',
        'visibility', old_row->'visibility'
      );
      new_state := jsonb_build_object(
        'verified', new_row->'verified',
        'visibility', new_row->'visibility'
      );
    when 'community_posts' then
      entity_kind := 'community_post';
      old_state := jsonb_build_object(
        'status', old_row->'status',
        'pinned', old_row->'pinned',
        'space_id', old_row->'space_id'
      );
      new_state := jsonb_build_object(
        'status', new_row->'status',
        'pinned', new_row->'pinned',
        'space_id', new_row->'space_id'
      );
    when 'community_spaces' then
      entity_kind := 'community_space';
      old_state := jsonb_build_object(
        'active', old_row->'active',
        'visibility', old_row->'visibility',
        'posting_policy', old_row->'posting_policy'
      );
      new_state := jsonb_build_object(
        'active', new_row->'active',
        'visibility', new_row->'visibility',
        'posting_policy', new_row->'posting_policy'
      );
    when 'chat_messages' then
      entity_kind := 'chat_message';
      old_state := jsonb_build_object('deleted_at', old_row->'deleted_at');
      new_state := jsonb_build_object('deleted_at', new_row->'deleted_at');
    else
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end case;

  select coalesce(array_agg(keys.key order by keys.key), '{}'::text[])
    into changed
  from jsonb_object_keys(coalesce(old_state, '{}'::jsonb) || coalesce(new_state, '{}'::jsonb)) as keys(key)
  where old_state -> keys.key is distinct from new_state -> keys.key;

  -- Em UPDATE, não cria ruído quando a moderação alterou campos não relacionados a decisão/visibilidade.
  if TG_OP = 'UPDATE' and cardinality(changed) = 0 then
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    action_name := 'deleted';
  elsif TG_OP = 'INSERT' then
    action_name := 'created';
  elsif array_position(changed, 'status') is not null then
    action_name := 'status:' || coalesce(new_state->>'status', 'unknown');
  elsif array_position(changed, 'verified') is not null then
    action_name := case when coalesce((new_state->>'verified')::boolean, false) then 'verified' else 'unverified' end;
  elsif array_position(changed, 'pinned') is not null then
    action_name := case when coalesce((new_state->>'pinned')::boolean, false) then 'pinned' else 'unpinned' end;
  elsif array_position(changed, 'active') is not null then
    action_name := case when coalesce((new_state->>'active')::boolean, false) then 'activated' else 'deactivated' end;
  elsif array_position(changed, 'deleted_at') is not null and new_state->>'deleted_at' is not null then
    action_name := 'message_removed';
  elsif array_position(changed, 'moderation_notes') is not null then
    action_name := 'moderation_note_changed';
  else
    action_name := 'updated';
  end if;

  if array_position(changed, 'moderation_notes') is not null then
    audit_note := nullif(left(new_state->>'moderation_notes', 500), '');
  end if;

  insert into public.community_moderation_audit (
    actor_id,
    entity_type,
    entity_id,
    action,
    changed_fields,
    before_state,
    after_state,
    note
  ) values (
    actor,
    entity_kind,
    entity_uuid,
    action_name,
    changed,
    old_state,
    new_state,
    audit_note
  );

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;

revoke all on function public.audit_community_moderation_change() from public, anon, authenticated;

-- Os triggers ficam no banco para capturar tanto ações da interface quanto RPCs protegidas.
drop trigger if exists audit_community_event_moderation on public.community_event_submissions;
create trigger audit_community_event_moderation
after insert or update or delete on public.community_event_submissions
for each row execute function public.audit_community_moderation_change();

drop trigger if exists audit_marketplace_moderation on public.marketplace_listings;
create trigger audit_marketplace_moderation
after insert or update or delete on public.marketplace_listings
for each row execute function public.audit_community_moderation_change();

drop trigger if exists audit_profile_moderation on public.community_profiles;
create trigger audit_profile_moderation
after update or delete on public.community_profiles
for each row execute function public.audit_community_moderation_change();

drop trigger if exists audit_post_moderation on public.community_posts;
create trigger audit_post_moderation
after insert or update or delete on public.community_posts
for each row execute function public.audit_community_moderation_change();

drop trigger if exists audit_space_moderation on public.community_spaces;
create trigger audit_space_moderation
after insert or update or delete on public.community_spaces
for each row execute function public.audit_community_moderation_change();

drop trigger if exists audit_chat_message_moderation on public.chat_messages;
create trigger audit_chat_message_moderation
after update or delete on public.chat_messages
for each row execute function public.audit_community_moderation_change();
