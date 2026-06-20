import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * POST /api/reading-pack  { rg }
 * → { rg, charter, key_rfcs[], active_drafts[], people[], foundational }
 *
 * Pacote de leitura para onboarding (M4 — versão inicial). A RFC 7418
 * ("An IRTF Primer for IETF Participants") é incluída como leitura fundacional.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rg = (body?.rg ?? "").toString().trim();
    if (!rg) return NextResponse.json({ error: "rg é obrigatório" }, { status: 400 });

    const supabase = createServiceClient();

    const { data: rgRow } = await supabase
      .from("rg")
      .select("id, name, charter_text, mail_list")
      .eq("id", rg)
      .maybeSingle();

    if (!rgRow) return NextResponse.json({ error: "rg não encontrado" }, { status: 404 });

    const { data: docs } = await supabase
      .from("document")
      .select("id, type, title, state, published_at")
      .eq("rg_id", rg)
      .order("published_at", { ascending: false, nullsFirst: false });

    const all = docs ?? [];
    const key_rfcs = all.filter((d) => d.type === "rfc").slice(0, 8);
    const active_drafts = all.filter((d) => d.type === "draft").slice(0, 12);

    const { data: people } = await supabase
      .from("document_author")
      .select("author:author_id ( id, full_name, affiliation_current ), document:document_id!inner ( rg_id )")
      .eq("document.rg_id", rg)
      .limit(40);

    type Person = { id: string; full_name: string; affiliation_current: string | null };
    // dedup de pessoas (o embed do Supabase pode vir como objeto ou array)
    const seen = new Set<string>();
    const peopleList: Person[] = [];
    for (const row of (people ?? []) as unknown[]) {
      const rawAuthor = (row as { author: Person | Person[] | null }).author;
      const a = Array.isArray(rawAuthor) ? rawAuthor[0] : rawAuthor;
      if (a && !seen.has(a.id)) {
        seen.add(a.id);
        peopleList.push(a);
      }
    }

    return NextResponse.json({
      rg: rgRow.id,
      name: rgRow.name,
      charter: rgRow.charter_text,
      mail_list: rgRow.mail_list,
      key_rfcs,
      active_drafts,
      people: peopleList.slice(0, 20),
      foundational: {
        id: "rfc7418",
        title: "An IRTF Primer for IETF Participants",
        url: "https://www.rfc-editor.org/rfc/rfc7418",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
