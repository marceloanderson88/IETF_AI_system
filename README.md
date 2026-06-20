# Bússola IRTF

Plataforma de **descoberta, acompanhamento e adjacência temática** sobre o corpus do IRTF
(grupos de pesquisa, drafts, RFCs e listas de e-mail), com a ponte IRTF→IETF preservada.

Esta é a **versão inicial (MVP)**, pensada para rodar **na Vercel** com **Supabase + Gemini**.

## Stack

| Função | Tecnologia |
|---|---|
| App + API | **Next.js (App Router)** na Vercel |
| Banco + vetor + auth | **Supabase** (Postgres + pgvector + Auth + RLS) |
| Geração (LLM) | **Gemini** (`@google/genai`) |
| Embeddings | **Gemini** (`text-embedding-004`, dim **768**) |
| Ingestão (batch) | **Python + ietfdata** (GitHub Actions) |
| Cron leve | **Vercel Cron** |
| Entrega (digest) | E-mail (stub / Resend no futuro) |

> Mudança em relação ao guia original: o LLM e os embeddings usam **Gemini** (não Anthropic/OpenAI).
> A **invariante** continua valendo: o mesmo modelo/dimensão de embedding é usado no batch (Python)
> e no online (TypeScript). Dimensão fixada em **768** (`text-embedding-004`).

## Dois planos (arquitetura)

- **Plano de dados (batch, Python — `ingestion/`):** ingestão via `ietfdata`, chunking, embeddings,
  escrita no Supabase. Roda no **GitHub Actions** (demorado/periódico).
- **Plano de serviço (online, TypeScript — `app/`):** descoberta, watches, adjacência e cron leve.
  Embedding **de query** acontece aqui. Deploy na **Vercel**.

## Início rápido

```bash
# 1. Banco (Supabase)
supabase db push        # aplica supabase/migrations/*

# 2. App
cd app
cp .env.example .env.local   # preencher as chaves
pnpm install
pnpm dev                     # http://localhost:3000

# 3. Ingestão (opcional, popula o corpus)
cd ../ingestion
pip install -r requirements.txt
python ingest.py
```

## Estrutura

```
app/         Next.js (deploy na Vercel; root = app/)
ingestion/   Python (ietfdata → Supabase) via GitHub Actions
supabase/    migrations SQL versionadas
.github/     CI + ingestão agendada
```

Veja `CLAUDE.md` para o contexto de desenvolvimento e os milestones M0..M8.
