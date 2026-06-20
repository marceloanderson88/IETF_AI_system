/**
 * Configuração central + invariante de embedding.
 *
 * A dimensão do embedding (EMBEDDINGS_DIM) DEVE ser igual à dimensão da coluna
 * `chunk.embedding` no Supabase (vector(768)). Trocar de modelo exige re-embedar
 * todo o corpus + alterar a coluna. Ver §6/§12.1 do guia de implementação.
 */

export const EMBEDDINGS_PROVIDER = process.env.EMBEDDINGS_PROVIDER ?? "gemini";
export const EMBEDDINGS_MODEL = process.env.EMBEDDINGS_MODEL ?? "text-embedding-004";
export const EMBEDDINGS_DIM = Number(process.env.EMBEDDINGS_DIM ?? "768");

/** Dimensão da coluna `chunk.embedding` na migration 0003. Fonte da verdade do schema. */
export const SCHEMA_EMBEDDING_DIM = 768;

export const LLM_MODEL_QUALITY = process.env.LLM_MODEL_QUALITY ?? "gemini-2.5-flash";
export const LLM_MODEL_CHEAP = process.env.LLM_MODEL_CHEAP ?? "gemini-2.0-flash";

/**
 * Falha cedo se a dimensão configurada não bater com o schema.
 * Chamado no boot dos route handlers e coberto por teste de CI.
 */
export function assertEmbeddingInvariant(): void {
  if (EMBEDDINGS_DIM !== SCHEMA_EMBEDDING_DIM) {
    throw new Error(
      `Invariante de embedding violada: EMBEDDINGS_DIM=${EMBEDDINGS_DIM} ` +
        `≠ dimensão da coluna chunk.embedding (${SCHEMA_EMBEDDING_DIM}). ` +
        `Re-embede o corpus e altere a coluna vector(N) antes de mudar isto.`,
    );
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}
