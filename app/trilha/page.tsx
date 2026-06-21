"use client";

import { useState } from "react";

type Candidate = { rg: string; rg_name: string; score: number; rationale: string };
type Doc = { id: string; title: string; type: string; state: string | null };
type Person = { id: string; full_name: string; affiliation_current: string | null };
type Pack = {
  name: string;
  charter: string | null;
  mail_list: string | null;
  key_rfcs: Doc[];
  active_drafts: Doc[];
  people: Person[];
  foundational: { id: string; title: string; url: string };
};
type Draft = { subject: string; body: string; tone_notes: string; mail_list?: string | null };

export default function TrilhaPage() {
  const [query, setQuery] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [pack, setPack] = useState<Pack | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  async function call<T>(url: string, payload: object): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "falha");
    return data as T;
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { candidates } = await call<{ candidates: Candidate[] }>("/api/route", {
        query_text: query.trim(),
      });
      setCandidates(candidates);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro");
    } finally {
      setLoading(false);
    }
  }

  async function choose(c: Candidate) {
    setChosen(c);
    setLoading(true);
    setError(null);
    try {
      const p = await call<Pack>("/api/reading-pack", { rg: c.rg });
      setPack(p);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro");
    } finally {
      setLoading(false);
    }
  }

  async function makeDraft() {
    if (!chosen) return;
    setLoading(true);
    setError(null);
    try {
      const d = await call<Draft>("/api/draft-message", {
        rg: chosen.rg,
        query_text: query.trim(),
        intent: "apresentar-se ao grupo e fazer uma pergunta inicial sobre o tema",
      });
      setDraft(d);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <div className="brand">Bússola IRTF</div>
      <h1>Trilha de entrada</h1>
      <p className="sub">Do tema ao primeiro contato, em quatro passos.</p>

      {/* 1. tema */}
      <article className="card">
        <div className="rg">1 · Seu tema</div>
        <form className="search" onSubmit={search} style={{ marginTop: 12 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='ex.: "energy-efficient IoT routing"'
            aria-label="tema"
          />
          <button type="submit" disabled={loading}>
            {loading && step === 1 ? "…" : "Buscar"}
          </button>
        </form>
      </article>

      {error && <p className="err">Erro: {error}</p>}

      {/* 2. grupo */}
      {step >= 2 && (
        <article className="card">
          <div className="rg">2 · Para onde levar</div>
          {candidates.length === 0 && <p className="empty">Nada recuperado — popule o corpus.</p>}
          {candidates.map((c) => (
            <div key={c.rg} className="evidence" style={{ borderTop: "none", paddingTop: 8 }}>
              <strong>{c.rg_name}</strong> <span className="acr">{c.rg}</span>
              <p className="item">{c.rationale}</p>
              <button className="search" onClick={() => choose(c)} disabled={loading}>
                Escolher {c.rg}
              </button>
            </div>
          ))}
        </article>
      )}

      {/* 3. pacote de leitura */}
      {step >= 3 && pack && (
        <article className="card">
          <div className="rg">3 · Pacote de leitura — {pack.name}</div>
          <p className="item">Lista: {pack.mail_list ?? "—"}</p>
          <p className="item">
            Fundacional:{" "}
            <a href={pack.foundational.url}>
              {pack.foundational.id.toUpperCase()} — {pack.foundational.title}
            </a>
          </p>
          <details className="evidence" open>
            <summary>{pack.key_rfcs.length} RFC(s) · {pack.active_drafts.length} draft(s)</summary>
            {[...pack.key_rfcs, ...pack.active_drafts].slice(0, 12).map((d) => (
              <div className="item" key={d.id}>
                <span className="meta">[{d.type}]</span> {d.title}
              </div>
            ))}
            {pack.people.length > 0 && (
              <p className="item">
                Pessoas: {pack.people.slice(0, 6).map((p) => p.full_name).join(", ")}
              </p>
            )}
          </details>
          <button className="search" onClick={makeDraft} disabled={loading}>
            {loading && step === 3 ? "…" : "Rascunhar primeira mensagem"}
          </button>
        </article>
      )}

      {/* 4. rascunho */}
      {step >= 4 && draft && (
        <article className="card">
          <div className="rg">4 · Rascunho da 1ª mensagem</div>
          <p className="item">
            <strong>To:</strong> {draft.mail_list ?? "—"}
          </p>
          <p className="item">
            <strong>Subject:</strong> {draft.subject}
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "var(--bg)",
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {draft.body}
          </pre>
          <p className="item">💡 {draft.tone_notes}</p>
        </article>
      )}
    </main>
  );
}
