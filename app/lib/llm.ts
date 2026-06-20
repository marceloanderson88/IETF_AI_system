import { GoogleGenAI } from "@google/genai";
import { LLM_MODEL_QUALITY, LLM_MODEL_CHEAP, requireEnv } from "@/lib/config";

/**
 * Wrapper sobre o SDK Gemini (@google/genai).
 * - quality: justificativa / rascunho de e-mail.
 * - cheap:   classificação de delta / tarefas baratas.
 *
 * REGRA: prompts de geração recebem só os trechos recuperados. O modelo é
 * proibido de citar grupo fora do conjunto canônico recuperado (sem trecho → sem afirmação).
 */
let client: GoogleGenAI | null = null;
function genai() {
  if (!client) client = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  return client;
}

type GenOpts = { tier?: "quality" | "cheap"; system?: string; temperature?: number };

export async function generate(prompt: string, opts: GenOpts = {}): Promise<string> {
  const model = opts.tier === "cheap" ? LLM_MODEL_CHEAP : LLM_MODEL_QUALITY;
  const res = await genai().models.generateContent({
    model,
    contents: prompt,
    config: {
      ...(opts.system ? { systemInstruction: opts.system } : {}),
      temperature: opts.temperature ?? 0.2,
    },
  });
  return res.text ?? "";
}
