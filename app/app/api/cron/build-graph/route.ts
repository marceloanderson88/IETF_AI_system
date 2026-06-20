import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cron/build-graph — Vercel Cron (semanal, domingo).
 * Protegido por CRON_SECRET.
 *
 * Reconstrói adjacency_edge por SINAL, com proveniência preservada:
 *   - semantic:      cosseno entre centróides de embedding dos grupos.
 *   - shared_author: nº de autores em comum (com a lista como evidência).
 *
 * Cada sinal é uma aresta própria (signal_type) — nunca colapsado num score único.
 * cross_citation/rare_term/mention ficam para quando houver dado de citação/menção.
 */
type SemanticRow = { rg_a: string; rg_b: string; weight: number };
type SharedAuthorRow = { rg_a: string; rg_b: string; weight: number; authors: string[] };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();
    let upserts = 0;

    // ── sinal semântico ──
    const { data: sem, error: semErr } = await supabase.rpc("compute_semantic_adjacency", {
      min_weight: 0.5,
    });
    if (semErr) throw new Error(`compute_semantic_adjacency: ${semErr.message}`);

    for (const e of (sem ?? []) as SemanticRow[]) {
      await upsertEdge(supabase, {
        rg_a: e.rg_a,
        rg_b: e.rg_b,
        signal_type: "semantic",
        weight: round(e.weight),
        evidence: { method: "centroid_cosine" },
        computed_at: now,
      });
      upserts++;
    }

    // ── sinal autor-comum ──
    const { data: sa, error: saErr } = await supabase.rpc("compute_shared_author_adjacency");
    if (saErr) throw new Error(`compute_shared_author_adjacency: ${saErr.message}`);

    for (const e of (sa ?? []) as SharedAuthorRow[]) {
      await upsertEdge(supabase, {
        rg_a: e.rg_a,
        rg_b: e.rg_b,
        signal_type: "shared_author",
        weight: e.weight,
        evidence: { shared_authors: e.authors?.slice(0, 20) ?? [] },
        computed_at: now,
      });
      upserts++;
    }

    return NextResponse.json({ ok: true, ran_at: now, edges_upserted: upserts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type Edge = {
  rg_a: string;
  rg_b: string;
  signal_type: string;
  weight: number;
  evidence: object;
  computed_at: string;
};

async function upsertEdge(
  supabase: ReturnType<typeof createServiceClient>,
  edge: Edge,
): Promise<void> {
  await supabase.from("adjacency_edge").upsert(edge, { onConflict: "rg_a,rg_b,signal_type" });
}

function round(n: number): number {
  return Number(n.toFixed(4));
}
