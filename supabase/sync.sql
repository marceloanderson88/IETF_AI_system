-- Datatracker -> Supabase group sync (SDD RF1, first slice).
-- Smart upsert called by /api/sync in server.js. Inserts new active groups;
-- for existing ones it only refreshes name/charter/status and never clobbers
-- curated description/tags. SECURITY DEFINER and granted only to service_role,
-- so it must be called from the server with the service-role key.
--
-- Apply with: supabase db execute < supabase/sync.sql
-- or via the Supabase MCP apply_migration tool.

create or replace function public.sync_groups(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  insert into public.groups (acronym, name, ecosystem, description, charter_url, status, tags)
  select upper(x->>'acronym'),
         x->>'name',
         x->>'ecosystem',
         coalesce(nullif(btrim(x->>'description'), ''), x->>'name'),
         x->>'charter_url',
         'active',
         '{}'::text[]
  from jsonb_array_elements(payload) as x
  where coalesce(btrim(x->>'acronym'), '') <> ''
    and coalesce(btrim(x->>'name'), '') <> ''
    and (x->>'ecosystem') in ('IRTF', 'IETF')
  on conflict (acronym) do update
    set name = excluded.name,
        charter_url = excluded.charter_url,
        status = 'active';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.sync_groups(jsonb) from anon, authenticated, public;
grant execute on function public.sync_groups(jsonb) to service_role;
