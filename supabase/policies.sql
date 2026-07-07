-- Row Level Security policies for Bussola IETF.
-- These reflect the policies applied to the production project
-- (ref lnikscxmhcrjbwxzspbj) and keep the repo reproducible (SDD RNF6/RNF7).
--
-- Model:
--   * Canonical catalog (sources, groups, documents, evidence, adjacency):
--     world-readable so the discovery experience works without login.
--   * User-owned data (profiles, watches, reading packs, drafts, feedback):
--     only the authenticated owner can read/write their rows.
--   * Opportunities are readable when they belong to one of the user's watches.

-- Canonical / public-read catalog -------------------------------------------
drop policy if exists "Public can read canonical sources" on public.ietf_sources;
create policy "Public can read canonical sources" on public.ietf_sources
  for select to anon, authenticated using (true);

drop policy if exists "Public can read groups" on public.groups;
create policy "Public can read groups" on public.groups
  for select to anon, authenticated using (true);

drop policy if exists "Public can read documents" on public.documents;
create policy "Public can read documents" on public.documents
  for select to anon, authenticated using (true);

drop policy if exists "Public can read evidence" on public.evidence;
create policy "Public can read evidence" on public.evidence
  for select to anon, authenticated using (true);

drop policy if exists "Public can read adjacency" on public.adjacency_edges;
create policy "Public can read adjacency" on public.adjacency_edges
  for select to anon, authenticated using (true);

-- User-owned data ------------------------------------------------------------
drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users manage own watches" on public.topic_watches;
create policy "Users manage own watches" on public.topic_watches
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users manage own reading packs" on public.reading_packs;
create policy "Users manage own reading packs" on public.reading_packs
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users manage own drafts" on public.draft_messages;
create policy "Users manage own drafts" on public.draft_messages
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users manage own feedback" on public.recommendation_feedback;
create policy "Users manage own feedback" on public.recommendation_feedback
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read opportunities for own watches" on public.opportunities;
create policy "Users read opportunities for own watches" on public.opportunities
  for select to authenticated
  using (watch_id in (
    select topic_watches.id from public.topic_watches
    where topic_watches.owner_id = (select auth.uid())
  ));

-- Hardening ------------------------------------------------------------------
-- rls_auto_enable() is a DDL event-trigger helper and must not be callable via
-- the REST/RPC API. The event trigger still fires on CREATE TABLE.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
