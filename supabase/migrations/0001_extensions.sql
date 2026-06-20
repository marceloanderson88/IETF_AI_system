-- Extensões necessárias
create extension if not exists vector;     -- pgvector (busca semântica)
create extension if not exists pg_trgm;    -- fuzzy match em siglas/acrônimos
