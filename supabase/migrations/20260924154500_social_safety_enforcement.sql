-- Aplica as regras sociais também a salas já existentes e notificações.

create or replace function public.enforce_chat_social_safety()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.sender_id <> auth.uid() then raise exception 'Remetente inválido'; end if;
  if not exists(select 1 from public.chat_room_members where room_id=new.room_id and profile_id=new.sender_id) then raise exception 'Você não participa desta conversa'; end if;
  if exists (
    select 1 from public.chat_rooms r
    join public.chat_room_members other on other.room_id=r.id and other.profile_id<>new.sender_id
    join public.community_profile_blocks b on
      (b.blocker_id=new.sender_id and b.blocked_id=other.profile_id) or
      (b.blocker_id=other.profile_id and b.blocked_id=new.sender_id)
    where r.id=new.room_id and r.room_type='direct'
  ) then raise exception 'Não é possível enviar mensagem nesta conversa'; end if;
  return new;
end;$$;

drop trigger if exists trg_chat_social_safety on public.chat_messages;
create trigger trg_chat_social_safety before insert on public.chat_messages
for each row execute function public.enforce_chat_social_safety();

-- Ao bloquear, remove convites/participações diretas futuras sem apagar o histórico da sala.
create or replace function public.can_contact_profile(source_profile_id uuid,target_profile_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select source_profile_id is not null and target_profile_id is not null
    and source_profile_id<>target_profile_id
    and not exists(select 1 from public.community_profile_blocks where
      (blocker_id=source_profile_id and blocked_id=target_profile_id) or
      (blocker_id=target_profile_id and blocked_id=source_profile_id));
$$;

-- Silenciamento não apaga conteúdo; apenas impede alertas originados pela pessoa silenciada.
create or replace function public.should_notify_profile(target_recipient uuid,target_actor uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select target_recipient is not null
    and (target_actor is null or not exists(select 1 from public.community_profile_mutes where muter_id=target_recipient and muted_id=target_actor))
    and (target_actor is null or not exists(select 1 from public.community_profile_blocks where
      (blocker_id=target_recipient and blocked_id=target_actor) or
      (blocker_id=target_actor and blocked_id=target_recipient)));
$$;

revoke all on function public.can_contact_profile(uuid,uuid) from public,anon;
revoke all on function public.should_notify_profile(uuid,uuid) from public,anon;
grant execute on function public.can_contact_profile(uuid,uuid) to authenticated;
grant execute on function public.should_notify_profile(uuid,uuid) to authenticated;
