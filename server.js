const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = process.env.PORT || 3000;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Calls a Postgres RPC through Supabase's REST endpoint. Throws when Supabase
// is not configured or the call fails, so callers can fall back gracefully.
async function supabaseRpc(fn, args, key = SUPABASE_KEY) {
  if (!SUPABASE_URL || !key) throw new Error("supabase_not_configured");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error(`rpc_${r.status}`);
  return r.json();
}

const requestListener = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parseBody = async () => new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
  });

  const mock = {
    groups: [
      { acronym: "T2TRG", name: "Thing-to-Thing Research Group", description: "Privacidade, telemetria, descoberta e comunicacao entre coisas.", tags: ["IoT", "Telemetria", "Privacidade"] },
      { acronym: "GAIA", name: "Global Access to the Internet for All", description: "Inclusao digital, acesso universal e infraestrutura comunitaria.", tags: ["Inclusao", "Acesso"] },
      { acronym: "CoRE", name: "Constrained RESTful Environments", description: "Protocolos RESTful para dispositivos restritos e conexoes com T2TRG.", tags: ["IETF", "Constrained", "CoAP"] },
      { acronym: "CFRG", name: "Crypto Forum Research Group", description: "Criptografia aplicada, seguranca e privacidade.", tags: ["Criptografia", "Seguranca"] }
    ],
    evidence: [
      { source: "T2TRG - Charter", group: "T2TRG", type: "Charter", confidence: 0.86, quote: "Privacidade, seguranca e confianca na coleta, processamento e troca de dados de telemetria entre coisas." },
      { source: "CoRE - Draft", group: "CoRE", type: "Internet-Draft", confidence: 0.83, quote: "Seguranca e privacidade em ambientes restritos, incluindo OAuth 2.0 para dispositivos." },
      { source: "GAIA - Material de reuniao", group: "GAIA", type: "Reuniao", confidence: 0.78, quote: "Discussao sobre privacidade em IoT de baixo custo e coleta minima de dados pessoais." }
    ],
    people: [
      { name: "Laura Castro", org: "Universitat Bremen", groups: ["CFRG", "TLS", "QUIC"] },
      { name: "Rafael Pacheco", org: "RNP", groups: ["T2TRG", "CoRE", "ROLL"] },
      { name: "Mariana Farias", org: "NIC.br", groups: ["GAIA", "HIP", "ICANN"] }
    ],
    opportunities: [
      { title: "Comentar rascunho do T2TRG antes do interim", group: "T2TRG", priority: "Alta" },
      { title: "Preparar contribuicao para o CoRE", group: "CoRE", priority: "Media" },
      { title: "Ler nova thread no GAIA", group: "GAIA", priority: "Media" }
    ]
  };

  if (url.pathname === "/api/discover") {
    const q = url.searchParams.get("q") || "";
    try {
      const rows = await supabaseRpc("bussola_search", { q });
      const grp = rows.filter((r) => r.kind === "group");
      const ev = rows.filter((r) => r.kind === "evidence");
      const maxRank = Math.max(0.000001, ...grp.map((g) => g.rank || 0));
      const candidates = grp.slice(0, 6).map((g) => ({
        acronym: g.grp,
        name: g.title.split(" - ").slice(1).join(" - ") || g.title,
        ecosystem: g.ecosystem,
        score: g.rank > 0 ? Math.round(55 + 40 * (g.rank / maxRank)) : 0,
        snippet: g.snippet,
        url: g.url,
        evidence: ev.filter((e) => e.grp === g.grp).map((e) => ({ snippet: e.snippet, url: e.url }))
      }));
      send(res, 200, JSON.stringify({ query: q, engine: "postgres-fts", generated_at: new Date().toISOString(), candidates }));
    } catch (err) {
      send(res, 200, JSON.stringify({ query: q, engine: "unavailable", candidates: null, error: String((err && err.message) || err) }));
    }
    return;
  }

  if (url.pathname === "/api/search") {
    const q = url.searchParams.get("q") || "";
    try {
      const rows = await supabaseRpc("bussola_search", { q });
      const results = rows.map((r) => ({
        type: r.kind === "group" ? "Grupo" : "Evidencia",
        title: r.title,
        text: r.snippet,
        tags: r.grp ? [r.grp] : [],
        route: r.kind === "group" ? "grupos" : "evidencias",
        rank: r.rank
      }));
      send(res, 200, JSON.stringify({ query: q, engine: "postgres-fts", count: results.length, results: results.slice(0, 20) }));
    } catch (err) {
      send(res, 200, JSON.stringify({ query: q, engine: "unavailable", results: null, error: String((err && err.message) || err) }));
    }
    return;
  }

  if (url.pathname === "/api/draft") {
    const body = await parseBody();
    const group = body.group || "T2TRG";
    const intent = body.intent || "Solicitar feedback";
    const subject = body.subject || "Privacy and telemetry in constrained devices";
    send(res, 200, JSON.stringify({
      subject,
      body: `Dear ${group},\n\nI am reviewing ${body.query || "privacy telemetry"} and would appreciate feedback from the group.\n\nIntent: ${intent}.\n\nQuestions:\n- Are the assumptions aligned with current work?\n- Which drafts or RFCs should be cited?\n- Are there deployment constraints we should consider?\n\nThanks in advance for your guidance.\n\nBest regards,\nBussola IETF demo user`,
      evidence: ["T2TRG - Charter", "CoRE - Draft", "GAIA - Meeting material"]
    }));
    return;
  }

  if (url.pathname === "/api/feedback") {
    const body = await parseBody();
    send(res, 200, JSON.stringify({ ok: true, recorded_at: new Date().toISOString(), ...body }));
    return;
  }

  if (url.pathname === "/api/watch") {
    if (req.method === "POST") {
      const body = await parseBody();
      send(res, 201, JSON.stringify({ ok: true, watch: { ...body, persisted: true } }));
    } else {
      send(res, 200, JSON.stringify({ watches: [{ title: "Privacidade em IoT", status: "Ativo", updates: 18 }] }));
    }
    return;
  }

  if (url.pathname === "/api/export") {
    send(res, 200, JSON.stringify({ kind: url.searchParams.get("kind") || "json", generated_at: new Date().toISOString(), data: mock }));
    return;
  }

  if (url.pathname === "/api/sync") {
    send(res, 200, JSON.stringify({ ok: true, source: url.searchParams.get("source") || "manual", synced_at: new Date().toISOString(), indexed_records: 1245, health: "Excelente" }));
    return;
  }

  const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(root, requested));
  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(root, "index.html"), (fallbackErr, fallback) => {
        if (fallbackErr) send(res, 404, "Not found", "text/plain; charset=utf-8");
        else send(res, 200, fallback, "text/html; charset=utf-8");
      });
      return;
    }
    send(res, 200, data, mime[path.extname(filePath)] || "application/octet-stream");
  });
};

if (process.env.VERCEL) {
  module.exports = requestListener;
} else {
  http.createServer(requestListener).listen(port, () => {
    console.log(`Bussola IETF running at http://localhost:${port}`);
  });
}
