-- ─── Tabelas de usuário: RLS restrito ao dono/time ──────────────────────────
alter table profile     enable row level security;
alter table topic_watch enable row level security;
alter table alert       enable row level security;

drop policy if exists "own profile" on profile;
create policy "own profile" on profile
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own or team watches" on topic_watch;
create policy "own or team watches" on topic_watch
  for all using (
    owner_id = auth.uid()
    or team_id in (select team_id from profile where id = auth.uid())
  );

drop policy if exists "alerts via watch" on alert;
create policy "alerts via watch" on alert
  for select using (
    topic_watch_id in (select id from topic_watch where
      owner_id = auth.uid()
      or team_id in (select team_id from profile where id = auth.uid()))
  );

-- ─── Corpus: leitura pública, escrita só via service-role ────────────────────
alter table rg             enable row level security;
alter table document       enable row level security;
alter table chunk          enable row level security;
alter table adjacency_edge enable row level security;

drop policy if exists "public read rg" on rg;
create policy "public read rg" on rg for select using (true);

drop policy if exists "public read document" on document;
create policy "public read document" on document for select using (true);

drop policy if exists "public read chunk" on chunk;
create policy "public read chunk" on chunk for select using (true);

drop policy if exists "public read adjacency" on adjacency_edge;
create policy "public read adjacency" on adjacency_edge for select using (true);
