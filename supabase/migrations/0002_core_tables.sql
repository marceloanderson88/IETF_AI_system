-- grupos canônicos (origem: Datatracker, type=rg, state=active)
create table if not exists rg (
  id           text primary key,           -- acronym, ex.: 't2trg'
  name         text not null,
  charter_text text,
  state        text not null default 'active',
  area         text,
  mail_list    text,
  is_irtf      boolean not null default true,
  updated_at   timestamptz not null default now()
);

-- documentos: drafts e RFCs
create table if not exists document (
  id           text primary key,           -- ex.: 'draft-irtf-t2trg-...'
  type         text not null check (type in ('draft','rfc')),
  rg_id        text references rg(id),
  title        text not null,
  abstract     text,
  full_text    text,
  state        text,                        -- GANCHO FASE 3: estado de processo
  rev          text,
  stream       text,                        -- 'IRTF', 'IETF', ...
  expires_at   timestamptz,
  published_at timestamptz,
  updated_at   timestamptz not null default now()
);

create table if not exists author (
  id                  text primary key,     -- person id do Datatracker
  full_name           text not null,
  affiliation_current text
);

create table if not exists document_author (
  document_id text references document(id) on delete cascade,
  author_id   text references author(id)   on delete cascade,
  ord         int,
  primary key (document_id, author_id)
);

-- mensagens de lista (agregável por thread)
create table if not exists mail_message (
  id             text primary key,
  list           text not null,
  thread_id      text,
  subject        text,
  sent_at        timestamptz,
  from_author_id text references author(id),
  body           text
);

create index if not exists document_rg_idx on document (rg_id);
create index if not exists mail_message_list_idx on mail_message (list);
