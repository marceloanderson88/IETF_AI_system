# Bússola IRTF — contexto para o Claude Code

Plataforma de descoberta, acompanhamento e adjacência temática sobre o corpus do IRTF.
Stack: **Next.js (Vercel) + Supabase (Postgres/pgvector/Auth) + Gemini + Python ietfdata (GitHub Actions)**.

## Dois planos
- Plano de dados: `ingestion/` (Python, batch, GitHub Actions). Ingestão + embeddings.
- Plano de serviço: `app/` (TypeScript, Vercel). Descoberta, watches, adjacência, cron leve.

## Regras invioláveis
- **Mesmo modelo/dim de embedding** em `ingestion/embed.py` e `app/lib/embeddings.ts`
  (Gemini `text-embedding-004`, **dim 768** = coluna `chunk.embedding`).
- `rg` só do Datatracker (state=active). O LLM **nunca** inventa grupo.
- `SUPABASE_SERVICE_ROLE_KEY` só no servidor. Cron protegido por `CRON_SECRET`.
- Ingestão pesada só no GitHub Actions, nunca em rota Vercel (timeout).
- Toda resposta de roteamento/alerta carrega `evidence[]`. Sem trecho → sem afirmação.
- `document.state` e `adjacency_edge.signal_type` separados desde já (gancho Fase 3).

## Ordem de trabalho (milestones)
- **M0** Scaffolding ✅
- **M1** Banco (migrations 0001–0004) ✅
- **M2** Ingestão mínima (GAIA + T2TRG) — esqueleto Python ✅
- **M3** Descoberta explicável (`/api/route` + UI) ✅
- **M4** Artefatos assistidos (reading-pack, draft-message, /trilha) ✅
- **M5** Auth + watches (login magic-link, `/api/watch`, deltas, /torre, known_rgs) ✅
- **M6** Acompanhamento contínuo (cron run-watches gera alertas FYI) — parcial; falta digest/e-mail
- M7 Adjacência temática (Fase 3)
- M8 Ponte IRTF→IETF + hardening

## Comandos
- App: `cd app && pnpm dev` | `pnpm build` | `pnpm typecheck` | `pnpm lint`
- DB: `supabase db push`
- Ingestão local: `cd ingestion && python ingest.py`
