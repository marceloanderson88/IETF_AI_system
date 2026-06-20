-- perfil estende auth.users (Supabase Auth)
create table if not exists profile (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  whatsapp   text,
  team_id    uuid,
  known_rgs  text[] not null default '{}',  -- filtro de adjacência + termômetro de nível
  created_at timestamptz not null default now()
);

create table if not exists team (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists topic_watch (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references profile(id) on delete cascade,
  team_id     uuid references team(id),          -- tema COLETIVO (null = individual)
  label       text not null,
  query_text  text not null,
  scope       text not null default 'thematic' check (scope in ('thematic','process')),
  created_at  timestamptz not null default now(),
  last_run_at timestamptz
);

create table if not exists alert (
  id             uuid primary key default gen_random_uuid(),
  topic_watch_id uuid references topic_watch(id) on delete cascade,
  kind           text not null check (kind in ('fyi','action_window','maturation')),
  target_rg      text references rg(id),
  payload        jsonb,
  evidence       jsonb,
  created_at     timestamptz not null default now(),
  delivered_at   timestamptz
);
