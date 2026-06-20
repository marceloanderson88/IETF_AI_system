import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/run-watches — Vercel Cron (semanal).
 * Protegido por CRON_SECRET (header Authorization: Bearer <CRON_SECRET>).
 *
 * Versão inicial: valida o segredo e responde ok. A lógica de diff/curadoria/
 * classificação de `kind`/digest entra no M6.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  // TODO (M6): reexecutar cada topic_watch, diff vs last_run_at, curar relevância,
  // classificar kind (fyi/action_window), montar digest, entregar, atualizar last_run_at.
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), processed: 0 });
}
