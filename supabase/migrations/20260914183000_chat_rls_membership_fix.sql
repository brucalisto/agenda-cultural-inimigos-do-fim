-- Avoid recursive RLS evaluation when checking chat membership.
create or replace function public.is_chat_room_member(target_room_id uuid, target_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_room_members
    where room_id = target_room_id and profile_id = target_profile_id
  );
$$;

revoke all on function public.is_chat_room_member(uuid, uuid) from public;
grant execute on function public.is_chat_room_member(uuid, uuid) to authenticated;

drop policy if exists "Room members see rooms" on public.chat_rooms;
create policy "Room members see rooms" on public.chat_rooms for select to authenticated
using (public.is_chat_room_member(id));

drop policy if exists "Room members see membership" on public.chat_room_members;
create policy "Room members see membership" on public.chat_room_members for select to authenticated
using (public.is_chat_room_member(room_id));

drop policy if exists "Room members read messages" on public.chat_messages;
create policy "Room members read messages" on public.chat_messages for select to authenticated
using (public.is_chat_room_member(room_id));

drop policy if exists "Room members send messages" on public.chat_messages;
create policy "Room members send messages" on public.chat_messages for insert to authenticated
with check (sender_id = auth.uid() and public.is_chat_room_member(room_id));
