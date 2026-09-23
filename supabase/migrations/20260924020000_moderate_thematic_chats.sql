-- Moderação administrativa das conversas temáticas.
-- Reaproveita a tabela de administradores existente do painel.

create or replace function public.moderate_thematic_chat(
  target_room_id uuid,
  decision text,
  notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users where id = auth.uid()
  ) then
    raise exception 'Acesso administrativo necessário';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'Decisão inválida';
  end if;

  update public.chat_rooms
  set approval_status = decision,
      moderation_notes = nullif(trim(coalesce(notes, '')), ''),
      updated_at = now()
  where id = target_room_id
    and room_type = 'group'
    and approval_status = 'pending';

  if not found then
    raise exception 'Conversa temática pendente não encontrada';
  end if;
end;
$$;

revoke all on function public.moderate_thematic_chat(uuid, text, text) from public, anon, authenticated;
grant execute on function public.moderate_thematic_chat(uuid, text, text) to authenticated;
