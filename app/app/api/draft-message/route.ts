import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { embedQuery } from "@/lib/embeddings";
import { generate } from "@/lib/llm";
import { assertEmbeddingInvariant } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

type MatchRow = { source_type: string; source_id: string; text: string };

/**
 * POST /api/draft-message  { rg, query_text, intent? }
 * → { subject, body, tone_notes }
 *
 * Rascunho da primeira mensagem à lista do grupo, no tom IETF (objetivo, técnico,
 * sem floreio). Fundamentado SOMENTE nos trechos recuperados do próprio grupo —
 * o modelo não inventa fatos nem cita trabalhos fora do que foi recuperado.
 */
export async function POST(req: Request) {
  try {
    assertEmbeddingInvariant();
    const body = await req.json().catch(() => ({}));
    const rg = (body?.rg ?? "").toString().trim();
    const queryText = (body?.query_text ?? "").toString().trim();
    const intent = (body?.intent ?? "apresentar interesse e fazer uma pergunta inicial")
      .toString()
      .trim();

    if (!rg || !queryText) {
      return NextResponse.json({ error: "rg e query_text são obrigatórios" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: rgRow } = await supabase
      .from("rg")
      .select("id, name, mail_list")
      .eq("id", rg)
      .maybeSingle();
    if (!rgRow) return NextResponse.json({ error: "rg não encontrado" }, { status: 404 });

    // contexto do próprio grupo (rg_filter) para ancorar o rascunho
    const queryEmbedding = await embedQuery(queryText);
    const { data, error } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      query_text: queryText,
      match_count: 8,
      rg_filter: rg,
    });
    if (error) throw new Error(`match_chunks falhou: ${error.message}`);
    const rows = (data ?? []) as MatchRow[];

    const trechos = rows
      .map((r, i) => `[${i + 1}] (${r.source_type} ${r.source_id})\n${r.text.slice(0, 500)}`)
      .join("\n\n");

    const system =
      "Você ajuda recém-chegados a escrever a primeira mensagem para uma lista de discussão " +
      "do IRTF/IETF. Tom: objetivo, técnico, cordial e breve; sem marketing, sem bajulação. " +
      "Use SOMENTE o contexto fornecido; não invente RFCs, drafts ou nomes. " +
      "Responda em JSON válido com as chaves: subject (string), body (string), tone_notes (string). " +
      "O body deve ser em inglês (norma das listas); tone_notes em português explicando as escolhas.";

    const prompt =
      `Grupo: ${rgRow.name} (${rg}). Lista: ${rgRow.mail_list ?? "—"}.\n` +
      `Tema/interesse do usuário: "${queryText}".\n` +
      `Intenção da mensagem: ${intent}.\n\n` +
      `Contexto recuperado do grupo:\n${trechos || "(sem trechos recuperados)"}\n\n` +
      `Gere o rascunho em JSON.`;

    const raw = await generate(prompt, { tier: "quality", system, temperature: 0.3 });
    const parsed = safeParseJson(raw);

    return NextResponse.json({
      subject: parsed?.subject ?? `Interest in ${rgRow.name}: ${queryText}`,
      body: parsed?.body ?? raw.trim(),
      tone_notes:
        parsed?.tone_notes ??
        "Rascunho gerado; revise nomes próprios e adapte ao seu contexto antes de enviar.",
      mail_list: rgRow.mail_list,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeParseJson(s: string): { subject?: string; body?: string; tone_notes?: string } | null {
  try {
    const cleaned = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
