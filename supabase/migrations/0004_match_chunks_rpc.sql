-- Busca híbrida: funde recuperação densa (vetor) e lexical (full-text)
-- por Reciprocal Rank Fusion (RRF). Resolve o jargão IETF (sigla exata)
-- sem perder semântica.
create or replace function match_chunks(
  query_embedding vector(768),
  query_text      text,
  match_count     int  default 40,
  rg_filter       text default null,
  k               int  default 60          -- constante de RRF
)
returns table (
  chunk_id    bigint,
  source_type text,
  source_id   text,
  rg_id       text,
  text        text,
  score       double precision
) language sql stable as $$
  with dense as (
    select id, row_number() over (
      order by embedding <=> query_embedding
    ) as rnk
    from chunk
    where (rg_filter is null or rg_id = rg_filter)
      and embedding is not null
    order by embedding <=> query_embedding
    limit match_count
  ),
  sparse as (
    select id, row_number() over (
      order by ts_rank(tsv, websearch_to_tsquery('english', query_text)) desc
    ) as rnk
    from chunk
    where tsv @@ websearch_to_tsquery('english', query_text)
      and (rg_filter is null or rg_id = rg_filter)
    limit match_count
  ),
  fused as (
    select coalesce(d.id, s.id) as id,
           coalesce(1.0/(k + d.rnk), 0) + coalesce(1.0/(k + s.rnk), 0) as score
    from dense d
    full outer join sparse s on d.id = s.id
  )
  select c.id, c.source_type, c.source_id, c.rg_id, c.text, f.score
  from fused f join chunk c on c.id = f.id
  order by f.score desc
  limit match_count;
$$;
