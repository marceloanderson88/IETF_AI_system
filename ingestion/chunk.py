"""Chunking simples de textos (charter/draft/rfc/mail).

Estratégia inicial: janela por parágrafos com alvo de ~1200 caracteres e
overlap leve. Suficiente para a Fase 1; refinar por tipo de fonte depois.
"""
from __future__ import annotations

TARGET = 1200
OVERLAP = 150


def chunk_text(text: str, target: int = TARGET, overlap: int = OVERLAP) -> list[str]:
    if not text:
        return []
    text = text.strip()
    if len(text) <= target:
        return [text]

    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paras:
        if len(buf) + len(p) + 2 <= target:
            buf = f"{buf}\n\n{p}" if buf else p
        else:
            if buf:
                chunks.append(buf)
            # parágrafo muito grande: corta em janelas
            if len(p) > target:
                start = 0
                while start < len(p):
                    chunks.append(p[start : start + target])
                    start += target - overlap
                buf = ""
            else:
                buf = p
    if buf:
        chunks.append(buf)
    return chunks
