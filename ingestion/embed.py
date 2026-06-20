"""Embeddings em batch via Gemini (mesmo modelo/dim do app — invariante)."""
from __future__ import annotations

from google import genai
from google.genai import types

from config import EMBEDDINGS_MODEL, EMBEDDINGS_DIM, GEMINI_API_KEY

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY ausente.")
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Gera embeddings para uma lista de textos, preservando a ordem."""
    if not texts:
        return []
    client = _get_client()
    out: list[list[float]] = []
    # A API aceita batches; mantemos lotes modestos para evitar limites.
    for i in range(0, len(texts), 64):
        batch = texts[i : i + 64]
        resp = client.models.embed_content(
            model=EMBEDDINGS_MODEL,
            contents=batch,
            config=types.EmbedContentConfig(output_dimensionality=EMBEDDINGS_DIM),
        )
        for e in resp.embeddings:
            vals = list(e.values)
            if len(vals) != EMBEDDINGS_DIM:
                raise RuntimeError(
                    f"Embedding dim {len(vals)} ≠ esperado {EMBEDDINGS_DIM}."
                )
            out.append(vals)
    return out
