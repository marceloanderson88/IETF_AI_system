"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Edge = {
  neighbor: string;
  neighbor_name: string;
  signal_type: string;
  weight: number;
  evidence: unknown;
};

const SIGNAL_COLOR: Record<string, string> = {
  semantic: "#4c8dff",
  shared_author: "#2dd4bf",
  cross_citation: "#f59e0b",
  rare_term: "#a78bfa",
  mention: "#f472b6",
};

export default function GrafoPage() {
  const [rgs, setRgs] = useState<{ id: string; name: string }[]>([]);
  const [rg, setRg] = useState("");
  const [hardOnly, setHardOnly] = useState(false);
  const [edges, setEdges] = useState<Edge[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("rg")
      .select("id, name")
      .order("id")
      .then(({ data }) => {
        setRgs(data ?? []);
        if (data && data.length && !rg) setRg(data[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(targetRg: string, hard: boolean) {
    if (!targetRg) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (hard) qs.set("min_signal", "hard");
      const res = await fetch(`/api/adjacency/${targetRg}?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "falha");
      setEdges(data.edges ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro");
    } finally {
      setLoading(false);
    }
  }

  // layout radial simples
  const W = 720;
  const H = 460;
  const cx = W / 2;
  const cy = H / 2;
  const R = 170;
  const maxW = Math.max(1, ...(edges ?? []).map((e) => e.weight));

  return (
    <main className="container">
      <div className="brand">Bússola IRTF</div>
      <h1>Grafo de adjacência</h1>
      <p className="sub">
        Vizinhança temática de um grupo, por sinal. Cada cor é uma proveniência distinta —
        sinais não são colapsados num número só.
      </p>

      <div className="search" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={rg}
          onChange={(e) => setRg(e.target.value)}
          style={{ padding: 12, background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 10 }}
        >
          {rgs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.id})
            </option>
          ))}
        </select>
        <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={hardOnly} onChange={(e) => setHardOnly(e.target.checked)} />
          só não-óbvio (sinais fortes)
        </label>
        <button onClick={() => load(rg, hardOnly)} disabled={loading || !rg}>
          {loading ? "…" : "Ver grafo"}
        </button>
      </div>

      {error && <p className="err">Erro: {error}</p>}

      {edges && edges.length === 0 && (
        <p className="empty">
          Nenhuma aresta para {rg}. Rode o cron build-graph (precisa de corpus embedado).
        </p>
      )}

      {edges && edges.length > 0 && (
        <>
          <svg width={W} height={H} style={{ maxWidth: "100%", marginTop: 16 }}>
            {edges.map((e, i) => {
              const ang = (2 * Math.PI * i) / edges.length - Math.PI / 2;
              const x = cx + R * Math.cos(ang);
              const y = cy + R * Math.sin(ang);
              const color = SIGNAL_COLOR[e.signal_type] ?? "#888";
              return (
                <g key={`${e.neighbor}-${e.signal_type}`}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={x}
                    y2={y}
                    stroke={color}
                    strokeWidth={1 + 4 * (e.weight / maxW)}
                    opacity={0.7}
                  />
                  <circle cx={x} cy={y} r={22} fill="#141b24" stroke={color} strokeWidth={2} />
                  <text x={x} y={y - 28} fill="#e6edf3" fontSize={11} textAnchor="middle">
                    {e.neighbor}
                  </text>
                  <text x={(cx + x) / 2} y={(cy + y) / 2} fill={color} fontSize={10} textAnchor="middle">
                    {e.signal_type} {e.weight}
                  </text>
                </g>
              );
            })}
            <circle cx={cx} cy={cy} r={30} fill="#4c8dff" />
            <text x={cx} y={cy + 4} fill="#fff" fontSize={13} fontWeight={700} textAnchor="middle">
              {rg}
            </text>
          </svg>

          <details className="evidence" open>
            <summary>{edges.length} aresta(s)</summary>
            {edges.map((e) => (
              <div className="item" key={`${e.neighbor}-${e.signal_type}`}>
                <span className="meta" style={{ color: SIGNAL_COLOR[e.signal_type] }}>
                  [{e.signal_type}]
                </span>{" "}
                {e.neighbor_name} ({e.neighbor}) · peso {e.weight}
              </div>
            ))}
          </details>
        </>
      )}
    </main>
  );
}
