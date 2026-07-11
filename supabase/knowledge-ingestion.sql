-- Knowledge ingestion tables for Bussola IETF.
-- This file intentionally does not alter public.bi_drafts. That table belongs
-- to another analytics app and should be treated as read-only by Bussola.

create extension if not exists pgcrypto;

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_slug text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_seen integer not null default 0,
  rows_upserted integer not null default 0,
  error text,
  metadata jsonb not null default '{}'
);

create table if not exists public.datatracker_documents (
  name text primary key,
  title text not null,
  document_type text,
  stream text,
  group_acronym text,
  state text,
  intended_std_level text,
  std_level text,
  rev text,
  pages integer,
  abstract text,
  url text not null,
  datatracker_resource text,
  submitted_at timestamptz,
  updated_at timestamptz,
  metadata jsonb not null default '{}',
  collected_at timestamptz not null default now()
);

create table if not exists public.rfc_index (
  rfc_number integer primary key,
  title text not null,
  doc_id text,
  stream text,
  area text,
  status text,
  pub_date date,
  url text not null,
  metadata jsonb not null default '{}',
  collected_at timestamptz not null default now()
);

create table if not exists public.meeting_events (
  meeting_id text primary key,
  number integer,
  name text not null,
  city text,
  country text,
  timezone text,
  starts_on date,
  ends_on date,
  url text,
  metadata jsonb not null default '{}',
  collected_at timestamptz not null default now()
);

create table if not exists public.meeting_sessions (
  session_id text primary key,
  meeting_id text references public.meeting_events(meeting_id) on delete cascade,
  group_acronym text,
  name text,
  session_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  room text,
  agenda_url text,
  materials_url text,
  metadata jsonb not null default '{}',
  collected_at timestamptz not null default now()
);

create table if not exists public.meeting_materials (
  material_id text primary key,
  session_id text references public.meeting_sessions(session_id) on delete cascade,
  meeting_id text references public.meeting_events(meeting_id) on delete cascade,
  group_acronym text,
  title text not null,
  material_type text,
  url text not null,
  uploaded_at timestamptz,
  metadata jsonb not null default '{}',
  collected_at timestamptz not null default now()
);

create table if not exists public.mail_messages (
  message_id text primary key,
  list_name text not null,
  subject text,
  sender_name text,
  sender_email text,
  sent_at timestamptz,
  url text not null,
  snippet text,
  metadata jsonb not null default '{}',
  collected_at timestamptz not null default now()
);

create table if not exists public.group_participants (
  participant_id text primary key,
  group_acronym text not null,
  name text not null,
  email text,
  role text,
  affiliation text,
  source_url text,
  metadata jsonb not null default '{}',
  collected_at timestamptz not null default now()
);

create index if not exists idx_dt_documents_group on public.datatracker_documents(group_acronym);
create index if not exists idx_dt_documents_updated on public.datatracker_documents(updated_at desc);
create index if not exists idx_dt_documents_type on public.datatracker_documents(document_type);
create index if not exists idx_rfc_index_doc_id on public.rfc_index(doc_id);
create index if not exists idx_meeting_sessions_group on public.meeting_sessions(group_acronym);
create index if not exists idx_meeting_sessions_starts on public.meeting_sessions(starts_at desc);
create index if not exists idx_meeting_materials_group on public.meeting_materials(group_acronym);
create index if not exists idx_mail_messages_list_sent on public.mail_messages(list_name, sent_at desc);
create index if not exists idx_group_participants_group on public.group_participants(group_acronym);

alter table public.ingestion_runs enable row level security;
alter table public.datatracker_documents enable row level security;
alter table public.rfc_index enable row level security;
alter table public.meeting_events enable row level security;
alter table public.meeting_sessions enable row level security;
alter table public.meeting_materials enable row level security;
alter table public.mail_messages enable row level security;
alter table public.group_participants enable row level security;

drop policy if exists "Public can read ingestion catalog documents" on public.datatracker_documents;
create policy "Public can read ingestion catalog documents" on public.datatracker_documents
  for select to anon, authenticated using (true);

drop policy if exists "Public can read rfc index" on public.rfc_index;
create policy "Public can read rfc index" on public.rfc_index
  for select to anon, authenticated using (true);

drop policy if exists "Public can read meeting events" on public.meeting_events;
create policy "Public can read meeting events" on public.meeting_events
  for select to anon, authenticated using (true);

drop policy if exists "Public can read meeting sessions" on public.meeting_sessions;
create policy "Public can read meeting sessions" on public.meeting_sessions
  for select to anon, authenticated using (true);

drop policy if exists "Public can read meeting materials" on public.meeting_materials;
create policy "Public can read meeting materials" on public.meeting_materials
  for select to anon, authenticated using (true);

drop policy if exists "Public can read mail messages" on public.mail_messages;
create policy "Public can read mail messages" on public.mail_messages
  for select to anon, authenticated using (true);

drop policy if exists "Public can read group participants" on public.group_participants;
create policy "Public can read group participants" on public.group_participants
  for select to anon, authenticated using (true);

-- Keep run logs server-only for now.
revoke all on public.ingestion_runs from anon, authenticated;

insert into public.ietf_sources (slug, name, source_type, url, freshness_minutes) values
  ('datatracker-documents', 'IETF Datatracker Documents API', 'datatracker', 'https://datatracker.ietf.org/api/v1/doc/document/', 30),
  ('datatracker-meetings', 'IETF Datatracker Meetings API', 'meeting', 'https://datatracker.ietf.org/api/v1/meeting/', 60),
  ('rfc-index-xml', 'RFC Editor RFC Index XML', 'rfc', 'https://www.rfc-editor.org/rfc/rfc-index.xml', 1440),
  ('mailarchive-json', 'IETF Mail Archive', 'email', 'https://mailarchive.ietf.org', 30)
on conflict (slug) do update
  set name = excluded.name,
      source_type = excluded.source_type,
      url = excluded.url,
      freshness_minutes = excluded.freshness_minutes;
