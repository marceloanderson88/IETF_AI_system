-- Cálculo de adjacência por sinal (Fase 3).
-- Proveniência preservada: cada sinal vira uma aresta própria em adjacency_edge
-- (signal_type), NUNCA um score único. Estas funções só CALCULAM; o cron
-- build-graph faz o upsert com evidência.

-- Sinal SEMÂNTICO: similaridade de cosseno entre os centróides de embedding
-- de cada par de grupos. Requer o agregado avg(vector) do pgvector (>= 0.5).
create or replace function compute_semantic_adjacency(min_weight double precision default 0.0)
returns table (rg_a text, rg_b text, weight double precision)
language sql stable as $$
  with centroids as (
    select rg_id, avg(embedding) as c
    from chunk
    where rg_id is not null and embedding is not null
    group by rg_id
  )
  select a.rg_id, b.rg_id, (1 - (a.c <=> b.c))::double precision as weight
  from centroids a
  join centroids b on a.rg_id < b.rg_id
  where (1 - (a.c <=> b.c)) >= min_weight;
$$;

-- Sinal AUTOR-COMUM: número de autores que publicaram em ambos os grupos.
create or replace function compute_shared_author_adjacency()
returns table (rg_a text, rg_b text, weight double precision, authors text[])
language sql stable as $$
  with da as (
    select distinct d.rg_id, doc_au.author_id
    from document_author doc_au
    join document d on d.id = doc_au.document_id
    where d.rg_id is not null
  )
  select a.rg_id,
         b.rg_id,
         count(*)::double precision as weight,
         array_agg(distinct au.full_name) as authors
  from da a
  join da b on a.author_id = b.author_id and a.rg_id < b.rg_id
  join author au on au.id = a.author_id
  group by a.rg_id, b.rg_id;
$$;
