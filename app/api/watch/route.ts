import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/watch  { label, query_text, team_id?, scope? }  → { watch_id }
 * Requer sessão (Supabase Auth). RLS garante que só o dono/time veem o watch.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const label = (body?.label ?? "").toString().trim();
    const queryText = (body?.query_text ?? "").toString().trim();
    const teamId = body?.team_id ? body.team_id.toString() : null;
    const scope = body?.scope === "process" ? "process" : "thematic";
    if (!label || !queryText) {
      return NextResponse.json({ error: "label e query_text são obrigatórios" }, { status: 400 });
    }

    // garante a existência do profile (FK de topic_watch.owner_id)
    await supabase.from("profile").upsert({ id: user.id }, { onConflict: "id" });

    const { data, error } = await supabase
      .from("topic_watch")
      .insert({
        owner_id: user.id,
        team_id: teamId,
        label,
        query_text: queryText,
        scope,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ watch_id: data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET /api/watch → lista os watches do usuário (dono ou time). */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

    const { data, error } = await supabase
      .from("topic_watch")
      .select("id, label, query_text, scope, created_at, last_run_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ watches: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
