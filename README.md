# Bússola IETF

Demo web app para navegar atividades IRTF/IETF com recomendacoes explicaveis, acompanhamentos, pacotes de leitura, mapas de adjacencia, oportunidades e trilhas de evidencias.

## Rodar localmente

```bash
node server.js
```

Abra `http://localhost:3000`.

## Deploy na Vercel

Este repositorio esta pronto para importacao na Vercel. Use o projeto `marceloanderson88/IETF_AI_system` e mantenha as configuracoes padrao.

Variaveis opcionais:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

## Supabase

O schema inicial esta em `supabase/schema.sql`. Ele cria tabelas para perfis, fontes, grupos, evidencias, acompanhamentos, oportunidades, adjacencias, pacotes de leitura, rascunhos e feedback com RLS habilitado.

## Coleta de conhecimento

As tabelas e o coletor para Datatracker, RFC Index, materiais/reunioes e Mail
Archive estao em `supabase/knowledge-ingestion.sql` e
`scripts/ingest-ietf-knowledge.mjs`.

Importante: `public.bi_drafts` pertence ao app de analise estatistica e nao e
alterada por este pipeline. Veja `docs/knowledge-ingestion.md`.
