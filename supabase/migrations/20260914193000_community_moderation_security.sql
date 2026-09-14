-- Tighten member permissions and grant moderation access to admin/reviewer roles.
drop policy if exists "Members manage own profile" on public.community_profiles;
create policy "Members insert own profile" on public.community_profiles for insert to authenticated
with check (id = auth.uid() and verified = false);
create policy "Members update own profile" on public.community_profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid() and verified = false);
create policy "Members delete own profile" on public.community_profiles for delete to authenticated using (id = auth.uid());

drop policy if exists "Members manage own listings" on public.marketplace_listings;
create policy "Members create own pending listings" on public.marketplace_listings for insert to authenticated
with check (owner_id = auth.uid() and status in ('draft','pending'));
create policy "Members update own unpublished listings" on public.marketplace_listings for update to authenticated
using (owner_id = auth.uid() and status in ('draft','pending','rejected','paused'))
with check (owner_id = auth.uid() and status in ('draft','pending','paused'));
create policy "Members delete own listings" on public.marketplace_listings for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "Members create own event submissions" on public.community_event_submissions;
create policy "Members create own pending event submissions" on public.community_event_submissions for insert to authenticated
with check (author_id = auth.uid() and status in ('draft','processing','needs_information','pending_review'));

create policy "Moderators manage community profiles" on public.community_profiles for all to authenticated
using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'))
with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'));
create policy "Moderators manage marketplace listings" on public.marketplace_listings for all to authenticated
using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'))
with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'));
create policy "Moderators manage event submissions" on public.community_event_submissions for all to authenticated
using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'))
with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'));
create policy "Admins manage platform tools" on public.platform_tools for all to authenticated
using (private.has_role(auth.uid(),'admin')) with check (private.has_role(auth.uid(),'admin'));
create policy "Moderators manage spaces" on public.community_spaces for all to authenticated
using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'))
with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'));
create policy "Moderators manage posts" on public.community_posts for all to authenticated
using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'))
with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'revisor'));
