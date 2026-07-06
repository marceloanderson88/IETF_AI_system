create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  locale text not null default 'pt-BR',
  experience_level text not null default 'beginner',
  organization text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);

create table if not exists public.ietf_sources (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  source_type text not null,
  url text not null,
  status text not null default 'active',
  freshness_minutes integer not null default 60,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  acronym text unique not null,
  name text not null,
  ecosystem text not null check (ecosystem in ('IRTF', 'IETF')),
  description text not null,
  charter_url text,
  status text not null default 'active',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete set null,
  source_id uuid references public.ietf_sources(id) on delete set null,
  title text not null,
  document_type text not null,
  url text not null,
  status text not null default 'active',
  published_at date,
  updated_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  source_type text not null,
  claim text not null,
  excerpt text not null,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  evidence_url text,
  collected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);

create table if not exists public.topic_watches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  label text not null,
  query_text text,
  watch_type text not null,
  scope text not null default 'IRTF + IETF',
  known_groups text[] not null default '{}',
  frequency text not null default 'weekly',
  channels text[] not null default '{panel}',
  min_confidence numeric(4,3) not null default 0.650,
  status text not null default 'active',
  locale text not null default 'pt-BR',
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid references public.topic_watches(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  title text not null,
  opportunity_type text not null,
  urgency text not null default 'medium',
  recommended_action text not null,
  due_at timestamptz,
  confidence numeric(4,3) not null default 0.700,
  evidence_ids uuid[] not null default '{}',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.adjacency_edges (
  id uuid primary key default gen_random_uuid(),
  group_a uuid not null references public.groups(id) on delete cascade,
  group_b uuid not null references public.groups(id) on delete cascade,
  signal_types text[] not null default '{}',
  weight numeric(5,3) not null,
  confidence numeric(4,3) not null,
  evidence_ids uuid[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(group_a, group_b)
);

create table if not exists public.reading_packs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  title text not null,
  description text not null,
  locale text not null default 'pt-BR',
  items jsonb not null default '[]',
  progress jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.draft_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  subject text not null,
  body text not null,
  intent text not null,
  output_language text not null default 'en',
  evidence_ids uuid[] not null default '{}',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  target_type text not null,
  target_id uuid,
  rating text not null,
  labels text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.ietf_sources enable row level security;
alter table public.groups enable row level security;
alter table public.documents enable row level security;
alter table public.evidence enable row level security;
alter table public.topic_watches enable row level security;
alter table public.opportunities enable row level security;
alter table public.adjacency_edges enable row level security;
alter table public.reading_packs enable row level security;
alter table public.draft_messages enable row level security;
alter table public.recommendation_feedback enable row level security;

insert into public.ietf_sources (slug, name, source_type, url, freshness_minutes) values
  ('datatracker', 'IETF Datatracker', 'datatracker', 'https://datatracker.ietf.org', 15),
  ('rfc-index', 'RFC Editor / RFC Index', 'rfc', 'https://www.rfc-editor.org', 60),
  ('mailarchive', 'IETF Mail Archive', 'email', 'https://mailarchive.ietf.org', 30),
  ('meeting-materials', 'IETF Meeting Materials', 'meeting', 'https://datatracker.ietf.org/meeting/materials/', 60)
on conflict (slug) do nothing;

insert into public.groups (acronym, name, ecosystem, description, charter_url, tags) values
  ('T2TRG', 'Thing-to-Thing Research Group', 'IRTF', 'Research on architecture and models for thing-to-thing communication.', 'https://datatracker.ietf.org/group/t2trg/about/', '{IoT,Telemetry,Privacy}'),
  ('GAIA', 'Global Access to the Internet for All', 'IRTF', 'Research group focused on inclusive and sustainable Internet access.', 'https://datatracker.ietf.org/group/gaia/about/', '{Access,Inclusion,Sustainability}'),
  ('CFRG', 'Crypto Forum Research Group', 'IRTF', 'Research forum for applied cryptography.', 'https://datatracker.ietf.org/group/cfrg/about/', '{Security,Cryptography,Privacy}'),
  ('DINRG', 'Decentralized Internet Research Group', 'IRTF', 'Research group on decentralized Internet infrastructure and governance.', 'https://datatracker.ietf.org/group/dinrg/about/', '{Decentralization,Governance,Identity}'),
  ('NMRG', 'Network Management Research Group', 'IRTF', 'Research group for network management, operation and automation.', 'https://datatracker.ietf.org/group/nmrg/about/', '{Operations,Measurement,Automation}'),
  ('CoRE', 'Constrained RESTful Environments', 'IETF', 'Working group for RESTful protocol work in constrained environments.', 'https://datatracker.ietf.org/group/core/about/', '{IETF,Constrained,CoAP}')
on conflict (acronym) do nothing;
