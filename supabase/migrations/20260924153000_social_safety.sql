-- Etapa 7 — Segurança social: bloqueio, silenciamento, denúncias e limites anti-spam.

create table if not exists public.community_profile_blocks (
  blocker_id uuid not null references public.community_profiles(id) on delete cascade,
  blocked_id uuid not null references public.community_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.community_profile_mutes (
  muter_id uuid not null references public.community_profiles(id) on delete cascade,
  muted_id uuid not null references public.community_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);

create table if not exists public.community_safety_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.community_profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.community_profile_blocks enable row level security;
alter table public.community_profile_mutes enable row level security;
alter table public.community_safety_audit enable row level security;

create policy "Users manage own blocks" on public.community_profile_blocks
for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "Users manage own mutes" on public.community_profile_mutes
for all using (muter_id = auth.uid()) with check (muter_id = auth.uid());
create policy "Admins read safety audit" on public.community_safety_audit
for select using (exists (select 1 from public.admin_users a where a.id = auth.uid()));

create or replace function public.set_profile_block(target_profile_id uuid, should_block boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'É necessário entrar'; end if;
  if target_profile_id is null or target_profile_id = auth.uid() then raise exception 'Perfil inválido'; end if;
  if not exists (select 1 from public.community_profiles where id=target_profile_id) then raise exception 'Perfil não encontrado'; end if;
  if should_block then
    insert into public.community_profile_blocks(blocker_id,blocked_id) values(auth.uid(),target_profile_id) on conflict do nothing;
    delete from public.community_profile_follows where (follower_id=auth.uid() and followed_id=target_profile_id) or (follower_id=target_profile_id and followed_id=auth.uid());
    insert into public.community_safety_audit(actor_id,action,target_type,target_id) values(auth.uid(),'profile_blocked','profile',target_profile_id);
  else
    delete from public.community_profile_blocks where blocker_id=auth.uid() and blocked_id=target_profile_id;
    insert into public.community_safety_audit(actor_id,action,target_type,target_id) values(auth.uid(),'profile_unblocked','profile',target_profile_id);
  end if;
end;$$;

create or replace function public.set_profile_mute(target_profile_id uuid, should_mute boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'É necessário entrar'; end if;
  if target_profile_id is null or target_profile_id = auth.uid() then raise exception 'Perfil inválido'; end if;
  if should_mute then
    insert into public.community_profile_mutes(muter_id,muted_id) values(auth.uid(),target_profile_id) on conflict do nothing;
  else
    delete from public.community_profile_mutes where muter_id=auth.uid() and muted_id=target_profile_id;
  end if;
end;$$;

create or replace function public.submit_community_report(target_type text,target_id uuid,report_reason text,report_details text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'É necessário entrar'; end if;
  if target_type not in ('profile','chat_room','chat_message','post','comment','marketplace_listing') then raise exception 'Tipo de denúncia inválido'; end if;
  if length(trim(coalesce(report_reason,''))) < 3 or length(trim(report_reason)) > 120 then raise exception 'Informe um motivo válido'; end if;
  if length(coalesce(report_details,'')) > 1500 then raise exception 'Detalhes muito longos'; end if;
  if (select count(*) from public.community_reports where reporter_id=auth.uid() and created_at > now()-interval '1 hour') >= 10 then raise exception 'Limite temporário de denúncias atingido'; end if;
  if exists (select 1 from public.community_reports where reporter_id=auth.uid() and entity_type=target_type and entity_id=target_id and status in ('open','pending')) then raise exception 'Você já denunciou este conteúdo'; end if;
  insert into public.community_reports(reporter_id,entity_type,entity_id,reason,details,status)
  values(auth.uid(),target_type,target_id,trim(report_reason),nullif(trim(coalesce(report_details,'')),''),'open') returning id into new_id;
  insert into public.community_safety_audit(actor_id,action,target_type,target_id,metadata) values(auth.uid(),'report_submitted',target_type,target_id,jsonb_build_object('report_id',new_id));
  return new_id;
end;$$;

-- Impede contato direto quando qualquer lado bloqueou o outro e limita criação repetida.
create or replace function public.start_direct_chat(target_profile_id uuid)
returns uuid language plpgsql security definer set search_path=public,private as $$
declare current_profile_id uuid:=auth.uid(); direct_room_id uuid; pair_key text;
begin
  if current_profile_id is null then raise exception 'É necessário entrar para iniciar uma conversa'; end if;
  if target_profile_id is null or current_profile_id=target_profile_id then raise exception 'Perfil de destino inválido'; end if;
  if not exists(select 1 from public.community_profiles where id=current_profile_id) then raise exception 'Crie seu perfil antes de iniciar uma conversa'; end if;
  if not exists(select 1 from public.community_profiles where id=target_profile_id and visibility='public' and allow_direct_messages=true) then raise exception 'Este perfil não está recebendo novas conversas'; end if;
  if exists(select 1 from public.community_profile_blocks where (blocker_id=current_profile_id and blocked_id=target_profile_id) or (blocker_id=target_profile_id and blocked_id=current_profile_id)) then raise exception 'Não é possível iniciar esta conversa'; end if;
  pair_key:=least(current_profile_id::text,target_profile_id::text)||':'||greatest(current_profile_id::text,target_profile_id::text);
  perform pg_advisory_xact_lock(hashtextextended(pair_key,0));
  select room.id into direct_room_id from public.chat_rooms room where room.room_type='direct'
    and (select count(*) from public.chat_room_members m where m.room_id=room.id)=2
    and exists(select 1 from public.chat_room_members m where m.room_id=room.id and m.profile_id=current_profile_id)
    and exists(select 1 from public.chat_room_members m where m.room_id=room.id and m.profile_id=target_profile_id)
    order by room.created_at asc limit 1;
  if direct_room_id is not null then return direct_room_id; end if;
  if (select count(*) from public.chat_rooms where owner_id=current_profile_id and room_type='direct' and created_at>now()-interval '1 hour')>=15 then raise exception 'Muitas novas conversas em pouco tempo. Tente novamente mais tarde'; end if;
  insert into public.chat_rooms(owner_id,name,room_type,description) values(current_profile_id,'Conversa privada','direct',null) returning id into direct_room_id;
  insert into public.chat_room_members(room_id,profile_id,member_role) values(direct_room_id,current_profile_id,'owner'),(direct_room_id,target_profile_id,'member');
  return direct_room_id;
end;$$;

revoke all on function public.set_profile_block(uuid,boolean) from public,anon;
revoke all on function public.set_profile_mute(uuid,boolean) from public,anon;
revoke all on function public.submit_community_report(text,uuid,text,text) from public,anon;
grant execute on function public.set_profile_block(uuid,boolean) to authenticated;
grant execute on function public.set_profile_mute(uuid,boolean) to authenticated;
grant execute on function public.submit_community_report(text,uuid,text,text) to authenticated;
