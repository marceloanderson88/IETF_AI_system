# Coleta de conhecimento IETF/IRTF

Este pipeline alimenta tabelas novas da Bussola IETF e **nao altera**
`public.bi_drafts`. Essa tabela pertence ao outro app de analise estatistica e
deve ser usada apenas como fonte de leitura quando necessario.

## O que entra

- `datatracker_documents`: drafts/documentos do Datatracker por RG/WG.
- `rfc_index`: RFC Index oficial do RFC Editor.
- `meeting_events`: reunioes IETF recentes.
- `meeting_sessions`: sessoes de reuniao por grupo.
- `meeting_materials`: agendas, slides e materiais vinculados a sessoes.
- `mail_messages`: mensagens recentes das listas publicas por grupo, via Mail Archive.
- `group_participants`: reservado para chairs/autores/participantes normalizados.

## 1. Criar as tabelas

Abra o SQL Editor do Supabase no projeto `IETF_System` e execute:

```text
supabase/knowledge-ingestion.sql
```

Esse SQL e idempotente: pode ser executado mais de uma vez.

## 2. Configurar variaveis locais

No PowerShell:

```powershell
$env:SUPABASE_URL="https://lnikscxmhcrjbwxzspbj.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<sua service_role key>"
```

Use a service role somente localmente ou em ambiente servidor. Nunca coloque
essa chave no frontend.

## 3. Rodar uma carga pequena para teste

```powershell
npm run ingest:knowledge -- --groups t2trg,gaia,cfrg,dinrg,nmrg --meetings 120,121 --recent-docs 80 --mail-limit 10
```

## 4. Rodar carga mais ampla

```powershell
npm run ingest:knowledge -- --recent-docs 250 --mail-limit 40
```

Por padrao, o script cobre os RGs principais do IRTF: `cfrg`, `dinrg`, `gaia`,
`hrpc`, `iccrg`, `icnrg`, `maprg`, `nmrg`, `panrg`, `pearg`, `qirg`,
`rasprg`, `t2trg`, `ufmrg`.

## Observacoes

- A API do Datatracker e o Mail Archive podem mudar formatos ou limitar alguns
  filtros. O script usa modo tolerante: se um endpoint falhar, ele pula aquela
  parte e continua.
- A tabela `bi_drafts` continua disponivel para cruzamentos analiticos, mas este
  pipeline nao faz `insert`, `update`, `delete` ou `alter` nela.
- Depois da carga, a busca e os mapas podem ser expandidos para usar essas novas
  tabelas como indice de evidencias, reunioes, materiais e mensagens.
