-- Notifica membros quando a moderação altera o estado de eventos e anúncios.
alter table public.community_notifications
  drop constraint if exists community_notifications_kind_check;
alter table public.community_notifications
  add constraint community_notifications_kind_check
  check (kind in ('comment','reaction','report_resolved','event_status','listing_status'));

alter table public.community_notifications
  drop constraint if exists community_notifications_entity_type_check;
alter table public.community_notifications
  add constraint community_notifications_entity_type_check
  check (entity_type in ('post','comment','report','event_submission','marketplace_listing'));

create or replace function public.notify_community_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_message text;
  notification_kind text;
  notification_entity text;
  recipient uuid;
begin
  if new.status is not distinct from old.status then return new; end if;

  if tg_table_name = 'community_event_submissions' then
    recipient := new.author_id;
    notification_kind := 'event_status';
    notification_entity := 'event_submission';
    notification_message := case new.status
      when 'needs_information' then 'Seu evento precisa de mais informações.'
      when 'changes_requested' then 'A moderação solicitou ajustes no seu evento.'
      when 'approved' then 'Seu evento foi aprovado e aguarda publicação.'
      when 'published' then 'Seu evento foi publicado na agenda.'
      when 'rejected' then 'Seu evento não foi aprovado. Confira a observação da moderação.'
      else null
    end;
  elsif tg_table_name = 'marketplace_listings' then
    recipient := new.owner_id;
    notification_kind := 'listing_status';
    notification_entity := 'marketplace_listing';
    notification_message := case new.status
      when 'published' then 'Seu anúncio foi publicado no marketplace.'
      when 'rejected' then 'Seu anúncio precisa de ajustes. Confira a observação da moderação.'
      else null
    end;
  end if;

  if notification_message is not null and recipient is not null then
    insert into public.community_notifications
      (recipient_id, actor_id, kind, entity_type, entity_id, message)
    values
      (recipient, case when auth.uid() = recipient then null else auth.uid() end,
       notification_kind, notification_entity, new.id, notification_message);
  end if;
  return new;
end;
$$;

revoke all on function public.notify_community_moderation_status() from public, anon, authenticated;

drop trigger if exists notify_event_submission_status on public.community_event_submissions;
create trigger notify_event_submission_status
after update of status on public.community_event_submissions
for each row execute function public.notify_community_moderation_status();

drop trigger if exists notify_marketplace_listing_status on public.marketplace_listings;
create trigger notify_marketplace_listing_status
after update of status on public.marketplace_listings
for each row execute function public.notify_community_moderation_status();
