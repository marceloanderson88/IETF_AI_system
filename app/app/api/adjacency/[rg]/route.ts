import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * GET /api/adjacency/[rg]?min_signal=hard&exclude=t2trg,gaia
 *  → { rg, edges[] }
 *
 * Retorna as arestas que tocam o grupo, agrupadas por sinal (proveniência preservada).
 * - min_signal=hard: só sinais de proveniência forte (shared_author, cross_citation),
 *   omitindo o puramente semântico — útil para o avançado ver o NÃO-óbvio.
 * - exclude: lista de grupos já conhecidos (known_rgs) a omitir (filtra o óbvio).
 */
const HARD_SIGNALS = new Set(["shared_author", "cross_citation", "rare_term", "mention"]);

export async function GET(req: Request, ctx: { params: Promise<{ rg: string }> }) {
  try {
    const { rg } = await ctx.params;
    const url = new URL(req.url);
    const minSignal = url.searchParams.get("min_signal") ?? "all";
    const exclude = new Set(
      (url.searchParams.get("exclude") ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("adjacency_edge")
      .select("rg_a, rg_b, signal_type, weight, evidence, computed_at")
      .or(`rg_a.eq.${rg},rg_b.eq.${rg}`)
      .order("weight", { ascending: false });
    if (error) throw new Error(error.message);

    const edges = (data ?? [])
      .map((e) => {
        const other = e.rg_a === rg ? e.rg_b : e.rg_a;
        return { neighbor: other, signal_type: e.signal_type, weight: e.weight, evidence: e.evidence };
      })
      .filter((e) => !exclude.has(e.neighbor.toLowerCase()))
      .filter((e) => (minSignal === "hard" ? HARD_SIGNALS.has(e.signal_type) : true));

    // nomes dos vizinhos
    const ids = [...new Set(edges.map((e) => e.neighbor))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: rgRows } = await supabase.from("rg").select("id, name").in("id", ids);
      for (const r of rgRows ?? []) names.set(r.id, r.name);
    }

    return NextResponse.json({
      rg,
      edges: edges.map((e) => ({ ...e, neighbor_name: names.get(e.neighbor) ?? e.neighbor })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
