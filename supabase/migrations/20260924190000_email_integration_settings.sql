-- Etapa 11: configuração administrativa do provedor de e-mail.
-- Senhas/chaves ficam armazenadas criptografadas via pgcrypto e nunca são retornadas ao navegador.

create extension if not exists pgcrypto;

create table if not exists public.email_integration_settings (
  id boolean primary key default true check (id),
  provider text not null default 'brevo' check (provider in ('brevo','smtp')),
  enabled boolean not null default false,
  host text,
  port integer not null default 587 check (port between 1 and 65535),
  secure boolean not null default false,
  username text,
  password_encrypted text,
  from_name text,
  from_email text,
  reply_to text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.community_profiles(id) on delete set null
);
alter table public.email_integration_settings enable row level security;
revoke all on public.email_integration_settings from public, anon, authenticated;

create or replace function public.email_settings_crypto_key()
returns text language sql stable security definer set search_path=public as $$
  select encode(extensions.digest(current_database() || ':' || coalesce(current_setting('app.settings.jwt_secret', true),'idf-email-config'), 'sha256'),'hex');
$$;
revoke all on function public.email_settings_crypto_key() from public,anon,authenticated;

create or replace function public.get_email_integration_settings()
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare uid uuid:=auth.uid(); s public.email_integration_settings%rowtype;
begin
  if uid is null or not exists(select 1 from public.admin_users where id=uid) then raise exception 'Acesso administrativo necessário'; end if;
  insert into public.email_integration_settings(id) values(true) on conflict(id) do nothing;
  select * into s from public.email_integration_settings where id=true;
  return jsonb_build_object('provider',s.provider,'enabled',s.enabled,'host',s.host,'port',s.port,'secure',s.secure,'username',s.username,'has_password',s.password_encrypted is not null,'from_name',s.from_name,'from_email',s.from_email,'reply_to',s.reply_to,'updated_at',s.updated_at);
end; $$;

create or replace function public.save_email_integration_settings(settings jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare uid uuid:=auth.uid(); selected_provider text:=coalesce(settings->>'provider','brevo'); supplied_password text:=nullif(settings->>'password','');
begin
  if uid is null or not exists(select 1 from public.admin_users where id=uid) then raise exception 'Acesso administrativo necessário'; end if;
  if selected_provider not in ('brevo','smtp') then raise exception 'Provedor inválido'; end if;
  if coalesce((settings->>'port')::integer,587) not between 1 and 65535 then raise exception 'Porta inválida'; end if;
  insert into public.email_integration_settings(id,provider,enabled,host,port,secure,username,password_encrypted,from_name,from_email,reply_to,updated_by)
  values(true,selected_provider,coalesce((settings->>'enabled')::boolean,false),nullif(settings->>'host',''),coalesce((settings->>'port')::integer,587),coalesce((settings->>'secure')::boolean,false),nullif(settings->>'username',''),case when supplied_password is null then null else extensions.pgp_sym_encrypt(supplied_password,public.email_settings_crypto_key())::text end,nullif(settings->>'from_name',''),nullif(settings->>'from_email',''),nullif(settings->>'reply_to',''),uid)
  on conflict(id) do update set provider=excluded.provider,enabled=excluded.enabled,host=excluded.host,port=excluded.port,secure=excluded.secure,username=excluded.username,password_encrypted=case when supplied_password is null then public.email_integration_settings.password_encrypted else excluded.password_encrypted end,from_name=excluded.from_name,from_email=excluded.from_email,reply_to=excluded.reply_to,updated_at=now(),updated_by=uid;
  return public.get_email_integration_settings();
end; $$;

revoke all on function public.get_email_integration_settings() from public,anon;
revoke all on function public.save_email_integration_settings(jsonb) from public,anon;
grant execute on function public.get_email_integration_settings() to authenticated;
grant execute on function public.save_email_integration_settings(jsonb) to authenticated;

-- Somente código backend com service role poderá recuperar a senha para efetuar o envio.
create or replace function public.get_email_transport_secret()
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare s public.email_integration_settings%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito ao backend'; end if;
  select * into s from public.email_integration_settings where id=true;
  if s.id is null then return null; end if;
  return jsonb_build_object('provider',s.provider,'enabled',s.enabled,'host',s.host,'port',s.port,'secure',s.secure,'username',s.username,'password',case when s.password_encrypted is null then null else extensions.pgp_sym_decrypt(s.password_encrypted::bytea,public.email_settings_crypto_key()) end,'from_name',s.from_name,'from_email',s.from_email,'reply_to',s.reply_to);
end; $$;
revoke all on function public.get_email_transport_secret() from public,anon,authenticated;
grant execute on function public.get_email_transport_secret() to service_role;
