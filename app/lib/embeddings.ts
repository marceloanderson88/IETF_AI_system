import { GoogleGenAI } from "@google/genai";
import {
  EMBEDDINGS_MODEL,
  EMBEDDINGS_DIM,
  assertEmbeddingInvariant,
  requireEnv,
} from "@/lib/config";

/**
 * Embedding de QUERY (online). Usa EXATAMENTE o mesmo modelo/dim do batch
 * (ingestion/embed.py) — invariante §6. text-embedding-004 → 768 dimensões.
 */
let client: GoogleGenAI | null = null;
function genai() {
  if (!client) client = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  return client;
}

export async function embedQuery(text: string): Promise<number[]> {
  assertEmbeddingInvariant();
  const res = await genai().models.embedContent({
    model: EMBEDDINGS_MODEL,
    contents: text,
    config: { outputDimensionality: EMBEDDINGS_DIM },
  });
  const values = res.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDINGS_DIM) {
    throw new Error(
      `Embedding retornou dimensão ${values?.length ?? 0}, esperado ${EMBEDDINGS_DIM}.`,
    );
  }
  return values;
}
