-- proveniência por sinal: NUNCA colapsar num score único (gancho Fase 3)
create table if not exists adjacency_edge (
  rg_a        text references rg(id),
  rg_b        text references rg(id),
  signal_type text not null check (signal_type in
              ('semantic','shared_author','cross_citation','rare_term','mention')),
  weight      double precision not null,
  evidence    jsonb,
  computed_at timestamptz not null default now(),
  primary key (rg_a, rg_b, signal_type)
);
create index if not exists adjacency_rg_a_idx on adjacency_edge (rg_a);
