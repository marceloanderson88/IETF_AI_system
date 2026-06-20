import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { routeQuery } from "@/lib/engine/route";
import { assertEmbeddingInvariant } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/route  { query_text } → { candidates[] } */
export async function POST(req: Request) {
  try {
    assertEmbeddingInvariant();
    const body = await req.json().catch(() => ({}));
    const queryText = (body?.query_text ?? "").toString().trim();
    if (!queryText) {
      return NextResponse.json({ error: "query_text é obrigatório" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const result = await routeQuery(supabase, queryText);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
