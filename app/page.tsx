"use client";

import { useState } from "react";

type Evidence = {
  chunk_id: number;
  source_type: string;
  source_id: string;
  text: string;
  score: number;
};
type Candidate = {
  rg: string;
  rg_name: string;
  score: number;
  rationale: string;
  evidence: Evidence[];
};

export default function DiscoveryPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setCandidates(null);
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query_text: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "falha na busca");
      setCandidates(data.candidates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <div className="brand">Bússola IRTF</div>
      <h1>Para onde levar o seu tema?</h1>
      <p className="sub">
        Descreva um tema de pesquisa e descubra quais grupos do IRTF são mais relevantes —
        com a evidência que justifica cada indicação.
      </p>

      <form className="search" onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='ex.: "congestion control para redes de satélite"'
          aria-label="tema de pesquisa"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </form>
      <p className="hint">Busca anônima. Para acompanhar um tema, será preciso entrar.</p>

      {loading && <p className="spin">Recuperando trechos e montando o ranking…</p>}
      {error && <p className="err">Erro: {error}</p>}

      {candidates && candidates.length === 0 && (
        <p className="empty">
          Nenhum grupo recuperado para esse tema. O corpus pode ainda não estar populado
          (rode a ingestão) ou tente reformular o tema.
        </p>
      )}

      {candidates?.map((c) => (
        <article className="card" key={c.rg}>
          <div className="head">
            <div className="rg">
              {c.rg_name}
              <span className="acr">{c.rg}</span>
            </div>
            <div className="score">score {c.score}</div>
          </div>
          <p className="rationale">{c.rationale}</p>
          {c.evidence.length > 0 && (
            <details className="evidence">
              <summary>{c.evidence.length} trecho(s) de evidência</summary>
              {c.evidence.map((ev) => (
                <div className="item" key={ev.chunk_id}>
                  <span className="meta">
                    [{ev.source_type} {ev.source_id}]
                  </span>{" "}
                  {ev.text.slice(0, 240)}
                  {ev.text.length > 240 ? "…" : ""}
                </div>
              ))}
            </details>
          )}
        </article>
      ))}
    </main>
  );
}
