-- chunks recuperáveis (semântico + lexical)
-- NOTA: dimensão = 768 (Gemini text-embedding-004). Invariante: igual em app e ingestion.
create table if not exists chunk (
  id          bigint generated always as identity primary key,
  source_type text not null check (source_type in ('charter','draft','rfc','mail')),
  source_id   text not null,
  rg_id       text references rg(id),
  text        text not null,
  embedding   vector(768),                 -- = EMBEDDINGS_DIM
  tsv         tsvector
);

-- full-text gerado a partir do texto
create or replace function chunk_tsv_trigger() returns trigger as $$
begin
  new.tsv := to_tsvector('english', coalesce(new.text,''));
  return new;
end $$ language plpgsql;

drop trigger if exists chunk_tsv_update on chunk;
create trigger chunk_tsv_update
  before insert or update on chunk
  for each row execute function chunk_tsv_trigger();

-- índices
create index if not exists chunk_embedding_hnsw on chunk
  using hnsw (embedding vector_cosine_ops);
create index if not exists chunk_tsv_gin on chunk using gin (tsv);
create index if not exists chunk_rg_idx on chunk (rg_id);
