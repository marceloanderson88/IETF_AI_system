# Producao: Bussola IETF

## Supabase

Projeto: `IETF_System`

- Project ref: `lnikscxmhcrjbwxzspbj`
- URL: `https://lnikscxmhcrjbwxzspbj.supabase.co`
- Publishable key: `sb_publishable_fmW-ZogHpyoo8NvcsRjs3A_nFwEdyxi`

Banco aplicado em producao:

- 11 tabelas publicas
- 5 fontes canonicas
- 7 grupos IRTF/IETF
- 4 documentos seed
- 4 evidencias seed
- 3 adjacencias seed
- RLS habilitado em todas as tabelas publicas

## Vercel

Importe o repositorio `marceloanderson88/IETF_AI_system` usando a branch:

`claude/happy-cerf-3ozxmn`

Configuracao recomendada:

- Framework Preset: `Other`
- Build Command: vazio
- Output Directory: vazio
- Install Command: padrao
- Node.js: `20.x` ou superior

Environment Variables em Production, Preview e Development:

```text
SUPABASE_URL=https://lnikscxmhcrjbwxzspbj.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_fmW-ZogHpyoo8NvcsRjs3A_nFwEdyxi
```

Nao configure `service_role` na Vercel para este frontend publico.

## Verificacao pos-deploy

1. Abra a URL da Vercel.
2. Teste `/api/discover?q=privacidade`.
3. Teste `/api/sources`.
4. Confirme que a interface abre em `Inicio`, `Descoberta`, `Grupos`, `Mapa de Adjacencia` e `Evidencias`.
