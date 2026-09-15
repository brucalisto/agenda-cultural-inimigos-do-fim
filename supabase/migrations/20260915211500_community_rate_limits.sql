-- Segurança da comunidade: limites de escrita contra spam/abuso.
--
-- Os fluxos da comunidade escrevem diretamente pelo cliente autenticado, então
-- o controle precisa existir no banco (e não apenas na interface). Os limites
-- abaixo são deliberadamente permissivos para uso humano normal e bloqueiam
-- rajadas automatizadas/loops acidentais.

create or replace function public.enforce_community_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor_id uuid := auth.uid();
  recent_count integer;
  actor_lock_key bigint;
begin
  -- Escritas internas/service-role não possuem auth.uid(). Moderação também
  -- precisa conseguir executar ações administrativas em lote sem este limite.
  if actor_id is null
     or private.has_role(actor_id, 'admin')
     or private.has_role(actor_id, 'revisor') then
    return new;
  end if;

  -- Serializa rajadas concorrentes do mesmo usuário por recurso. Sem isso,
  -- várias requisições simultâneas poderiam consultar a mesma contagem antes
  -- de qualquer uma delas ser confirmada.
  actor_lock_key := hashtext(tg_table_name || ':' || actor_id::text)::bigint;
  perform pg_advisory_xact_lock(actor_lock_key);

  -- Usuários comuns não controlam o relógio usado pelos limites.
  new.created_at := now();

  if tg_table_name = 'community_posts' then
    select count(*)
      into recent_count
      from public.community_posts
     where author_id = actor_id
       and created_at >= now() - interval '1 minute';

    if recent_count >= 5 then
      raise exception using
        errcode = 'P0001',
        message = 'Você publicou várias vezes em pouco tempo. Aguarde um minuto e tente novamente.';
    end if;

    select count(*)
      into recent_count
      from public.community_posts
     where author_id = actor_id
       and created_at >= now() - interval '1 hour';

    if recent_count >= 40 then
      raise exception using
        errcode = 'P0001',
        message = 'Limite temporário de publicações atingido. Tente novamente mais tarde.';
    end if;

  elsif tg_table_name = 'chat_messages' then
    select count(*)
      into recent_count
      from public.chat_messages
     where sender_id = actor_id
       and created_at >= now() - interval '1 minute';

    if recent_count >= 20 then
      raise exception using
        errcode = 'P0001',
        message = 'Muitas mensagens foram enviadas em sequência. Aguarde um instante e tente novamente.';
    end if;

    select count(*)
      into recent_count
      from public.chat_messages
     where sender_id = actor_id
       and created_at >= now() - interval '1 hour';

    if recent_count >= 400 then
      raise exception using
        errcode = 'P0001',
        message = 'Limite temporário de mensagens atingido. Tente novamente mais tarde.';
    end if;

  elsif tg_table_name = 'community_event_submissions' then
    select count(*)
      into recent_count
      from public.community_event_submissions
     where author_id = actor_id
       and created_at >= now() - interval '10 minutes';

    if recent_count >= 6 then
      raise exception using
        errcode = 'P0001',
        message = 'Muitos eventos foram enviados em sequência. Aguarde alguns minutos e tente novamente.';
    end if;

    select count(*)
      into recent_count
      from public.community_event_submissions
     where author_id = actor_id
       and created_at >= now() - interval '1 day';

    if recent_count >= 30 then
      raise exception using
        errcode = 'P0001',
        message = 'Limite diário de envios de eventos atingido. Tente novamente mais tarde.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_community_write_rate_limit() from public, anon;
grant execute on function public.enforce_community_write_rate_limit() to authenticated;

-- Índices específicos tornam as contagens por autor/remetente baratas mesmo
-- quando a comunidade crescer.
create index if not exists community_posts_author_created_idx
  on public.community_posts (author_id, created_at desc);

create index if not exists chat_messages_sender_created_idx
  on public.chat_messages (sender_id, created_at desc);

create index if not exists community_event_submissions_author_created_idx
  on public.community_event_submissions (author_id, created_at desc);

drop trigger if exists rate_limit_community_posts on public.community_posts;
create trigger rate_limit_community_posts
before insert on public.community_posts
for each row execute function public.enforce_community_write_rate_limit();

drop trigger if exists rate_limit_chat_messages on public.chat_messages;
create trigger rate_limit_chat_messages
before insert on public.chat_messages
for each row execute function public.enforce_community_write_rate_limit();

drop trigger if exists rate_limit_community_event_submissions on public.community_event_submissions;
create trigger rate_limit_community_event_submissions
before insert on public.community_event_submissions
for each row execute function public.enforce_community_write_rate_limit();
