# Ingestão (Plano de dados)

Python + Datatracker → Supabase. Roda no **GitHub Actions** (não no Vercel: é demorado).

## Local

```bash
pip install -r requirements.txt
export NEXT_PUBLIC_SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export GEMINI_API_KEY=...
export EMBEDDINGS_MODEL=text-embedding-004
export EMBEDDINGS_DIM=768
export TARGET_RGS=gaia,t2trg        # fatia inicial (M2)
python ingest.py
```

## O que faz (versão inicial)

1. Grupos canônicos (Datatracker `group/group`) → `rg`.
2. Documentos do grupo (`doc/document`) → `document` (captura `state` — gancho Fase 3).
3. `title + abstract` → chunking → embeddings (Gemini) → `chunk`.

## Invariante

`EMBEDDINGS_MODEL`/`EMBEDDINGS_DIM` aqui **são idênticos** aos do app
(`app/lib/config.ts`): `text-embedding-004`, dim **768** = coluna `chunk.embedding`.

## TODO (próximos milestones)

- Migrar para `ietfdata` (Glasgow IPL) para autores e mailarchive.
- `author` + `document_author` (resolução de identidade).
- `mail_message` (atividade de lista → sinal de score e deltas).
- Full text de drafts/RFCs e charter completo.
