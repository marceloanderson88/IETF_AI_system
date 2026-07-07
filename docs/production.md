# Producao: Bussola IETF

## Como o sistema funciona (v1)

- **Frontend:** SPA estatica (`index.html` + `src/*`) servida pelo `server.js`.
- **Motor de busca:** funcao Postgres `bussola_search(q)` (full-text
  `websearch_to_tsquery` + `ts_rank` sobre grupos e evidencias). Os endpoints
  `/api/discover` e `/api/search` no `server.js` chamam essa RPC via REST do
  Supabase e devolvem candidatos/resultados ranqueados. Se o Supabase estiver
  indisponivel, o frontend cai num scorer lexical no cliente (rotulado na tela).
- **Coleta de dados:** `/api/sync` puxa os grupos ativos do Datatracker e faz
  upsert na tabela `groups` via `sync_groups` (preserva descricao/tags curadas).
- **Catalogo:** grupos, evidencias e adjacencias vem do Supabase (RLS de leitura
  publica); as telas de usuario usam armazenamento local (login e ficticio).

## Supabase

Projeto: `IETF_System`

- Project ref: `lnikscxmhcrjbwxzspbj`
- URL: `https://lnikscxmhcrjbwxzspbj.supabase.co`
- Publishable key: `sb_publishable_fmW-ZogHpyoo8NvcsRjs3A_nFwEdyxi`

Migracoes/objetos em `supabase/`:

- `schema.sql` — tabelas base
- `policies.sql` — politicas RLS + hardening
- `search.sql` — funcao `bussola_search(q)` (motor de busca)
- `sync.sql` — funcao `sync_groups(payload)` (coleta Datatracker)

Aplique com o Supabase MCP (`apply_migration`) ou `supabase db execute`.

## Vercel

Importe o repositorio `marceloanderson88/IETF_AI_system` na branch `main`.

Configuracao recomendada:

- Framework Preset: `Other`
- Build Command: vazio
- Output Directory: vazio
- Node.js: `20.x` ou superior

Environment Variables (Production, Preview, Development):

```text
SUPABASE_URL=https://lnikscxmhcrjbwxzspbj.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_fmW-ZogHpyoo8NvcsRjs3A_nFwEdyxi
```

Para habilitar a coleta (`/api/sync`), adicione **apenas no servidor** (nunca
exposta ao cliente) a chave service_role:

```text
SUPABASE_SERVICE_ROLE_KEY=<service_role secreta do projeto>
```

Sem essa variavel, `/api/sync` responde `service_role_not_configured` e o resto
do app continua funcionando normalmente.

## Verificacao pos-deploy

1. Abra a URL da Vercel e entre com o login demo.
2. `/api/discover?q=cryptography` deve retornar `"engine":"postgres-fts"`.
3. `/api/search?q=privacy` deve retornar resultados ranqueados.
4. Descoberta deve mostrar "Motor: Postgres full-text".
5. (Opcional) `POST/GET /api/sync?type=rg` para sincronizar os RGs do Datatracker.
