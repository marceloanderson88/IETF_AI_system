"""Configuração compartilhada da ingestão.

INVARIANTE: o modelo/dimensão de embedding aqui DEVE ser igual ao do app
(app/lib/config.ts → text-embedding-004, dim 768). Trocar = re-embedar o corpus
e alterar a coluna chunk.embedding.
"""
import os

EMBEDDINGS_MODEL = os.environ.get("EMBEDDINGS_MODEL", "text-embedding-004")
EMBEDDINGS_DIM = int(os.environ.get("EMBEDDINGS_DIM", "768"))

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# RGs alvo da fatia inicial (M2): GAIA + T2TRG.
TARGET_RGS = [rg.strip() for rg in os.environ.get("TARGET_RGS", "gaia,t2trg").split(",") if rg.strip()]
