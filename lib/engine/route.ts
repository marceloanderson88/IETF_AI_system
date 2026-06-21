import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQuery } from "@/lib/embeddings";
import { generate } from "@/lib/llm";

export type Evidence = {
  chunk_id: number;
  source_type: string;
  source_id: string;
  text: string;
  score: number;
};

export type Candidate = {
  rg: string;
  rg_name: string;
  score: number;
  rationale: string;
  evidence: Evidence[];
};

type MatchRow = {
  chunk_id: number;
  source_type: string;
  source_id: string;
  rg_id: string | null;
  text: string;
  score: number;
};

/**
 * Engine de descoberta explicável (Fase 1).
 *
 * 1. embed(query)  — mesmo modelo do batch.
 * 2. match_chunks  — recuperação híbrida (RRF: vetor + full-text).
 * 3. agrega por rg → score multi-sinal (soma RRF + bônus por diversidade de fontes).
 * 4. LLM redige a justificativa SÓ a partir dos trechos recuperados (com evidência).
 *
 * Invariante: sem trecho recuperado → sem candidato. O LLM nunca cita grupo fora
 * do conjunto recuperado.
 */
export async function routeQuery(
  supabase: SupabaseClient,
  queryText: string,
  opts: { topN?: number; matchCount?: number } = {},
): Promise<{ candidates: Candidate[] }> {
  const topN = opts.topN ?? 3;
  const matchCount = opts.matchCount ?? 40;

  const queryEmbedding = await embedQuery(queryText);

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    query_text: queryText,
    match_count: matchCount,
  });
  if (error) throw new Error(`match_chunks falhou: ${error.message}`);

  const rows = (data ?? []) as MatchRow[];

  // agrega por rg (ignora chunks sem rg_id)
  const byRg = new Map<string, { score: number; evidence: Evidence[] }>();
  for (const r of rows) {
    if (!r.rg_id) continue;
    const e: Evidence = {
      chunk_id: r.chunk_id,
      source_type: r.source_type,
      source_id: r.source_id,
      text: r.text,
      score: r.score,
    };
    const cur = byRg.get(r.rg_id) ?? { score: 0, evidence: [] };
    cur.score += r.score;
    cur.evidence.push(e);
    byRg.set(r.rg_id, cur);
  }

  if (byRg.size === 0) return { candidates: [] };

  // bônus de diversidade: grupos sustentados por mais de um tipo de fonte sobem
  const scored = [...byRg.entries()]
    .map(([rg, v]) => {
      const sourceTypes = new Set(v.evidence.map((e) => e.source_type)).size;
      const diversityBonus = 1 + 0.1 * (sourceTypes - 1);
      return { rg, score: v.score * diversityBonus, evidence: v.evidence };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  // nomes canônicos dos rg
  const ids = scored.map((s) => s.rg);
  const { data: rgRows } = await supabase.from("rg").select("id, name").in("id", ids);
  const names = new Map((rgRows ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));

  // justificativa por candidato (somente a partir dos trechos)
  const candidates: Candidate[] = [];
  for (const s of scored) {
    const topEvidence = s.evidence.sort((a, b) => b.score - a.score).slice(0, 4);
    const rationale = await writeRationale(queryText, s.rg, names.get(s.rg) ?? s.rg, topEvidence);
    candidates.push({
      rg: s.rg,
      rg_name: names.get(s.rg) ?? s.rg,
      score: Number(s.score.toFixed(4)),
      rationale,
      evidence: topEvidence,
    });
  }

  return { candidates };
}

async function writeRationale(
  query: string,
  rg: string,
  rgName: string,
  evidence: Evidence[],
): Promise<string> {
  const trechos = evidence
    .map((e, i) => `[${i + 1}] (${e.source_type} ${e.source_id})\n${e.text.slice(0, 600)}`)
    .join("\n\n");

  const system =
    "Você é a Bússola IRTF. Explique, em português, por que o grupo de pesquisa indicado " +
    "é relevante para o tema do usuário. Use SOMENTE a informação dos trechos fornecidos. " +
    "Não invente nomes de grupos, RFCs ou pessoas que não estejam nos trechos. " +
    "Seja conciso (2-3 frases) e cite os trechos por [n].";

  const prompt =
    `Tema do usuário: "${query}"\n\n` +
    `Grupo candidato: ${rgName} (${rg})\n\n` +
    `Trechos recuperados:\n${trechos}\n\n` +
    `Escreva a justificativa.`;

  try {
    const out = await generate(prompt, { tier: "quality", system });
    return out.trim() || fallbackRationale(rgName, evidence);
  } catch {
    return fallbackRationale(rgName, evidence);
  }
}

function fallbackRationale(rgName: string, evidence: Evidence[]): string {
  const kinds = [...new Set(evidence.map((e) => e.source_type))].join(", ");
  return `${rgName} aparece em ${evidence.length} trecho(s) recuperado(s) (${kinds}) relacionados ao tema.`;
}
