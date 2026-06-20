"""Ingestão mínima (M2): GAIA + T2TRG.

Fluxo (versão inicial, runnable):
  1. grupos canônicos (Datatracker, type=rg) -> upsert rg
  2. documents (drafts/RFCs do grupo)        -> upsert document  (captura state)
  3. chunking (title+abstract) + embeddings  -> upsert chunk
  4. mail_message                            -> TODO (via ietfdata mailarchive)

Conjunto canônico FECHADO: rg vem só do Datatracker. O LLM nunca inventa grupo.
Upsert idempotente: re-rodar não duplica (chave primária natural).

Preferência do guia: usar `ietfdata` (Glasgow IPL). Esta versão inicial usa a
REST API pública do Datatracker (estável e documentada) para destravar a Fase 1;
a migração para `ietfdata` é um refinamento posterior sem mudar o schema.
"""
from __future__ import annotations

import sys

import httpx
from supabase import create_client

from config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    TARGET_RGS,
)
from chunk import chunk_text
from embed import embed_texts

DT = "https://datatracker.ietf.org/api/v1"


def supa():
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        sys.exit("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_group(client: httpx.Client, acronym: str) -> dict | None:
    r = client.get(f"{DT}/group/group/", params={"acronym": acronym, "format": "json"})
    r.raise_for_status()
    objs = r.json().get("objects", [])
    return objs[0] if objs else None


def fetch_documents(client: httpx.Client, acronym: str) -> list[dict]:
    docs: list[dict] = []
    url = f"{DT}/doc/document/"
    params = {"group__acronym": acronym, "format": "json", "limit": 100}
    while url:
        r = client.get(url, params=params)
        r.raise_for_status()
        data = r.json()
        docs.extend(data.get("objects", []))
        nxt = data.get("meta", {}).get("next")
        url = f"https://datatracker.ietf.org{nxt}" if nxt else None
        params = None  # next já traz a query
    return docs


def doc_type(name: str) -> str | None:
    if name.startswith("rfc"):
        return "rfc"
    if name.startswith("draft-"):
        return "draft"
    return None  # ignora charter/agenda/etc nesta fatia


def state_tail(states: list[str]) -> str | None:
    # states vem como lista de URIs; pega o último segmento do primeiro
    if not states:
        return None
    return states[0].rstrip("/").split("/")[-1]


def main() -> None:
    db = supa()
    with httpx.Client(timeout=60, headers={"User-Agent": "bussola-irtf-ingest"}) as client:
        for acr in TARGET_RGS:
            print(f"== {acr} ==")
            g = fetch_group(client, acr)
            if not g:
                print(f"  grupo {acr} não encontrado, pulando.")
                continue

            db.table("rg").upsert(
                {
                    "id": acr,
                    "name": g.get("name") or acr,
                    "state": "active",
                    "mail_list": g.get("list_email"),
                    "is_irtf": True,
                }
            ).execute()

            docs = fetch_documents(client, acr)
            print(f"  {len(docs)} documentos")

            chunk_rows: list[dict] = []
            for d in docs:
                name = d.get("name", "")
                dtype = doc_type(name)
                if not dtype:
                    continue
                title = d.get("title") or name
                abstract = d.get("abstract") or ""

                db.table("document").upsert(
                    {
                        "id": name,
                        "type": dtype,
                        "rg_id": acr,
                        "title": title,
                        "abstract": abstract,
                        "state": state_tail(d.get("states", [])),
                        "rev": d.get("rev"),
                        "stream": (d.get("stream") or "").rstrip("/").split("/")[-1] or None,
                    }
                ).execute()

                source_text = f"{title}\n\n{abstract}".strip()
                for piece in chunk_text(source_text):
                    chunk_rows.append(
                        {
                            "source_type": dtype,
                            "source_id": name,
                            "rg_id": acr,
                            "text": piece,
                        }
                    )

            if not chunk_rows:
                print("  nenhum chunk para embedar.")
                continue

            print(f"  embedando {len(chunk_rows)} chunks…")
            vectors = embed_texts([c["text"] for c in chunk_rows])
            for row, vec in zip(chunk_rows, vectors):
                row["embedding"] = vec

            # re-popular chunks deste grupo (idempotente): apaga e reinsere
            db.table("chunk").delete().eq("rg_id", acr).execute()
            for i in range(0, len(chunk_rows), 200):
                db.table("chunk").insert(chunk_rows[i : i + 200]).execute()
            print(f"  ok: {len(chunk_rows)} chunks inseridos.")

    print("ingestão concluída.")


if __name__ == "__main__":
    main()
