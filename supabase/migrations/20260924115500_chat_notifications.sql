-- Notificações persistentes para novas mensagens e respostas no chat.

create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  sender_name text;
  notification_text text;
begin
  select coalesce(artistic_name, display_name, 'Alguém') into sender_name
  from public.community_profiles where id = new.sender_id;

  notification_text := case
    when new.reply_to_id is not null then sender_name || ' respondeu uma mensagem na conversa.'
    else sender_name || ' enviou uma nova mensagem.'
  end;

  for recipient in
    select profile_id from public.chat_room_members
    where room_id = new.room_id and profile_id <> new.sender_id
  loop
    insert into public.community_notifications (
      recipient_id, actor_id, kind, entity_type, entity_id, message
    ) values (
      recipient, new.sender_id,
      case when new.reply_to_id is not null then 'chat_reply' else 'chat_message' end,
      'chat_room', new.room_id, notification_text
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_chat_message on public.chat_messages;
create trigger trg_notify_chat_message
after insert on public.chat_messages
for each row execute function public.notify_chat_message();
