"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Watch = {
  id: string;
  label: string;
  query_text: string;
  scope: string;
  last_run_at: string | null;
};

export default function TorrePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [knownRgs, setKnownRgs] = useState("");
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      setChecking(false);
      if (data.user) {
        await loadWatches();
        const { data: prof } = await supabase
          .from("profile")
          .select("known_rgs")
          .eq("id", data.user.id)
          .maybeSingle();
        if (prof?.known_rgs) setKnownRgs((prof.known_rgs as string[]).join(", "));
      }
    });
  }, []);

  async function loadWatches() {
    const res = await fetch("/api/watch");
    if (res.ok) setWatches((await res.json()).watches ?? []);
  }

  async function createWatch(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/watch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: label.trim(), query_text: query.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(`Erro: ${data?.error ?? "falha"}`);
      return;
    }
    setLabel("");
    setQuery("");
    await loadWatches();
  }

  async function saveKnownRgs() {
    setMsg(null);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const arr = knownRgs
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const { error } = await supabase
      .from("profile")
      .upsert({ id: data.user.id, known_rgs: arr }, { onConflict: "id" });
    setMsg(error ? `Erro: ${error.message}` : "Perfil salvo.");
  }

  if (checking) return <main className="container"><p className="spin">…</p></main>;

  if (!email) {
    return (
      <main className="container">
        <div className="brand">Bússola IRTF</div>
        <h1>Torre de vigia</h1>
        <p className="sub">
          É preciso entrar para acompanhar temas. <Link href="/login">Entrar →</Link>
        </p>
      </main>
    );
  }

  // nível derivado de known_rgs (vazio → entrada; populado → avançado)
  const advanced = knownRgs.trim().length > 0;

  return (
    <main className="container">
      <div className="brand">Bússola IRTF</div>
      <h1>Torre de vigia</h1>
      <p className="sub">
        {email} · nível {advanced ? "avançado" : "entrada"} (derivado dos seus grupos conhecidos)
      </p>
      {msg && <p className={msg.startsWith("Erro") ? "err" : "hint"}>{msg}</p>}

      <article className="card">
        <div className="rg">Seus grupos conhecidos</div>
        <p className="item">
          Define seu nível e filtra a adjacência (mostra só o não-óbvio).
        </p>
        <div className="search" style={{ marginTop: 8 }}>
          <input
            value={knownRgs}
            onChange={(e) => setKnownRgs(e.target.value)}
            placeholder="ex.: t2trg, gaia"
            aria-label="grupos conhecidos"
          />
          <button onClick={saveKnownRgs}>Salvar</button>
        </div>
      </article>

      <article className="card">
        <div className="rg">Acompanhar um novo tema</div>
        <form onSubmit={createWatch}>
          <div className="search" style={{ marginTop: 8 }}>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="rótulo (ex.: IoT routing)"
              aria-label="rótulo"
            />
          </div>
          <div className="search" style={{ marginTop: 8 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="consulta temática"
              aria-label="consulta"
            />
            <button type="submit">Criar watch</button>
          </div>
        </form>
      </article>

      <article className="card">
        <div className="rg">Watches ({watches.length})</div>
        {watches.length === 0 && <p className="empty">Nenhum watch ainda.</p>}
        {watches.map((w) => (
          <div className="item" key={w.id}>
            <strong>{w.label}</strong> — <span className="meta">{w.query_text}</span>
            <br />
            <span className="hint">
              {w.scope} · última execução: {w.last_run_at ?? "ainda não rodou"}
            </span>
          </div>
        ))}
      </article>
    </main>
  );
}
