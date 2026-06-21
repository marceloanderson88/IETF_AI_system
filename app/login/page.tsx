"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "falha ao enviar o link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <div className="brand">Bússola IRTF</div>
      <h1>Entrar</h1>
      <p className="sub">
        Para acompanhar temas (watches) e ver o digest, entre com um link mágico por e-mail.
      </p>

      {sent ? (
        <article className="card">
          <p className="rationale">
            Link enviado para <strong>{email}</strong>. Abra o e-mail e clique para entrar.
          </p>
        </article>
      ) : (
        <form className="search" onSubmit={sendLink}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email"
            aria-label="e-mail"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Enviando…" : "Enviar link"}
          </button>
        </form>
      )}
      {error && <p className="err">Erro: {error}</p>}
    </main>
  );
}
