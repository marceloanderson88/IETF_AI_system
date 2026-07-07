-- Full-text search engine for Bussola IETF (SDD RF2/RF3).
-- Unified ranked search over the canonical catalog: groups + evidence.
-- Uses Postgres full-text (websearch_to_tsquery + ts_rank) with the 'english'
-- config for stemming. SECURITY INVOKER so RLS still applies (catalog is
-- public-read, so anon can call it).
--
-- Apply with: supabase db execute < supabase/search.sql
-- or via the Supabase MCP apply_migration tool.

create or replace function public.bussola_search(q text)
returns table (
  kind text,
  ref_id uuid,
  title text,
  snippet text,
  grp text,
  ecosystem text,
  url text,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  with tsq as (
    select websearch_to_tsquery('english', coalesce(nullif(btrim(q), ''), 'a')) as query,
           nullif(btrim(q), '') is null as empty
  )
  -- Groups
  select 'group'::text,
         g.id,
         g.acronym || ' - ' || g.name,
         g.description,
         g.acronym,
         g.ecosystem,
         g.charter_url,
         case when tsq.empty then 0
              else ts_rank(
                to_tsvector('english', g.acronym || ' ' || g.name || ' ' || coalesce(g.description,'') || ' ' || array_to_string(g.tags,' ')),
                tsq.query) end
  from public.groups g, tsq
  where tsq.empty
     or tsq.query @@ to_tsvector('english', g.acronym || ' ' || g.name || ' ' || coalesce(g.description,'') || ' ' || array_to_string(g.tags,' '))
  union all
  -- Evidence
  select 'evidence'::text,
         e.id,
         coalesce(g2.acronym,'IETF') || ' - ' || e.source_type,
         e.excerpt,
         coalesce(g2.acronym,''),
         g2.ecosystem,
         e.evidence_url,
         case when tsq.empty then 0
              else ts_rank(
                to_tsvector('english', coalesce(e.claim,'') || ' ' || coalesce(e.excerpt,'')),
                tsq.query) end
  from public.evidence e
  left join public.groups g2 on g2.id = e.group_id, tsq
  where not tsq.empty
    and tsq.query @@ to_tsvector('english', coalesce(e.claim,'') || ' ' || coalesce(e.excerpt,''))
  order by rank desc, title
  limit 40;
$$;

grant execute on function public.bussola_search(text) to anon, authenticated;
