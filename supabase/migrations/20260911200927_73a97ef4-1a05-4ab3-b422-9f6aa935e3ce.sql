create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

revoke all on function private.has_role(uuid, public.app_role) from public, anon;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;

-- repoint policies
alter policy "Admins can view all roles" on public.user_roles using (private.has_role(auth.uid(), 'admin'));
alter policy "Admins can manage groups" on public.whatsapp_groups using (private.has_role(auth.uid(), 'admin'));
alter policy "Revisors can view groups" on public.whatsapp_groups using (private.has_role(auth.uid(), 'revisor'));
alter policy "Admins can manage messages" on public.whatsapp_messages using (private.has_role(auth.uid(), 'admin'));
alter policy "Revisors can view messages" on public.whatsapp_messages using (private.has_role(auth.uid(), 'revisor'));
alter policy "Admins can manage media" on public.message_media using (private.has_role(auth.uid(), 'admin'));
alter policy "Revisors can view media" on public.message_media using (private.has_role(auth.uid(), 'revisor'));
alter policy "Admins can manage links" on public.extracted_links using (private.has_role(auth.uid(), 'admin'));
alter policy "Revisors can view links" on public.extracted_links using (private.has_role(auth.uid(), 'revisor'));
alter policy "Admins can manage interpreted contents" on public.interpreted_contents using (private.has_role(auth.uid(), 'admin'));
alter policy "Revisors can view and edit interpreted contents" on public.interpreted_contents using (private.has_role(auth.uid(), 'revisor'));
alter policy "Admins can manage destinations" on public.publication_destinations using (private.has_role(auth.uid(), 'admin'));
alter policy "Revisors can view destinations" on public.publication_destinations using (private.has_role(auth.uid(), 'revisor'));
alter policy "Admins can manage publication records" on public.publication_records using (private.has_role(auth.uid(), 'admin'));
alter policy "Revisors can view publication records" on public.publication_records using (private.has_role(auth.uid(), 'revisor'));
alter policy "Admins can view webhook logs" on public.webhook_events using (private.has_role(auth.uid(), 'admin'));
alter policy "Admins have full access to automation_rules" on public.automation_rules using (private.has_role(auth.uid(), 'admin'));
alter policy "Revisors can select automation_rules" on public.automation_rules using (private.has_role(auth.uid(), 'revisor'));
alter policy "Admins have full access to automation_actions" on public.automation_actions using (private.has_role(auth.uid(), 'admin'));
alter policy "Revisors can select automation_actions" on public.automation_actions using (private.has_role(auth.uid(), 'revisor'));
alter policy "Admins have full access to admin_audit_logs" on public.admin_audit_logs using (private.has_role(auth.uid(), 'admin'));
alter policy "Admins can manage storage objects" on storage.objects using (private.has_role(auth.uid(), 'admin'));
alter policy "Revisors can read storage objects" on storage.objects using (private.has_role(auth.uid(), 'revisor'));

drop function if exists public.has_role(uuid, public.app_role);

-- profiles: explicit ownership-scoped insert
create policy "Users can insert their own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

-- user_roles: admin-only writes
create policy "Admins can insert roles"
on public.user_roles for insert to authenticated
with check (private.has_role(auth.uid(), 'admin'));

create policy "Admins can update roles"
on public.user_roles for update to authenticated
using (private.has_role(auth.uid(), 'admin'))
with check (private.has_role(auth.uid(), 'admin'));

create policy "Admins can delete roles"
on public.user_roles for delete to authenticated
using (private.has_role(auth.uid(), 'admin'));