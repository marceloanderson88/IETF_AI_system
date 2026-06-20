import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/watch/[id]/deltas → { deltas[] }
 * Retorna os alertas (deltas curados) já gerados para o watch. RLS garante o acesso.
 * A geração de novos deltas é feita pelo cron run-watches (M6).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

    const { data, error } = await supabase
      .from("alert")
      .select("id, kind, target_rg, payload, evidence, created_at, delivered_at")
      .eq("topic_watch_id", id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return NextResponse.json({ deltas: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
