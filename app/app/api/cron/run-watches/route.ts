import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { routeQuery } from "@/lib/engine/route";
import { assertEmbeddingInvariant } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cron/run-watches — Vercel Cron (semanal).
 * Protegido por CRON_SECRET (header Authorization: Bearer <CRON_SECRET>).
 *
 * Versão inicial (M6 mínimo): reexecuta cada topic_watch, monta o ranking de
 * grupos relevantes e registra um alerta FYI por grupo-candidato novo (dedupe
 * por watch+rg), sempre com evidência. Atualiza last_run_at.
 *
 * TODO: diff real vs. última execução, classificação action_window/maturation
 * (LLM_MODEL_CHEAP), agrupamento em digest e entrega por e-mail (Resend).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  try {
    assertEmbeddingInvariant();
    const supabase = createServiceClient();

    const { data: watches, error } = await supabase
      .from("topic_watch")
      .select("id, query_text");
    if (error) throw new Error(error.message);

    let alertsCreated = 0;
    for (const w of watches ?? []) {
      const { candidates } = await routeQuery(supabase, w.query_text, { topN: 3 });

      for (const c of candidates) {
        // dedupe: já existe alerta deste watch para este rg?
        const { data: existing } = await supabase
          .from("alert")
          .select("id")
          .eq("topic_watch_id", w.id)
          .eq("target_rg", c.rg)
          .limit(1);
        if (existing && existing.length > 0) continue;

        await supabase.from("alert").insert({
          topic_watch_id: w.id,
          kind: "fyi",
          target_rg: c.rg,
          payload: { rg_name: c.rg_name, score: c.score, rationale: c.rationale },
          evidence: c.evidence,
        });
        alertsCreated++;
      }

      await supabase
        .from("topic_watch")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", w.id);
    }

    return NextResponse.json({
      ok: true,
      ran_at: new Date().toISOString(),
      processed: watches?.length ?? 0,
      alerts_created: alertsCreated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
