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
    const q = (url.searchParams.get("q") || "privacy telemetry constrained devices").toLowerCase();
    send(res, 200, JSON.stringify({
      query: q,
      generated_at: new Date().toISOString(),
      candidates: [
        { acronym: "T2TRG", name: "Thing-to-Thing Research Group", score: q.includes("privacy") ? 0.92 : 0.84, next_action: "Gerar pacote de leitura", evidence: ["T2TRG charter"] },
        { acronym: "GAIA", name: "Global Access to the Internet for All", score: 0.86, next_action: "Ler discussoes recentes", evidence: ["GAIA meeting materials"] },
        { acronym: "CoRE", name: "Constrained RESTful Environments", score: 0.78, next_action: "Comparar adjacencia com T2TRG", evidence: ["RFC 9552"] }
      ]
    }));
    return;
  }

  if (url.pathname === "/api/search") {
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const rows = [
      ...mock.groups.map((g) => ({ type: "Grupo", title: `${g.acronym} - ${g.name}`, text: g.description, tags: g.tags, route: "grupos" })),
      ...mock.evidence.map((e) => ({ type: "Evidencia", title: e.source, text: e.quote, tags: [e.group, e.type], route: "evidencias" })),
      ...mock.people.map((p) => ({ type: "Pessoa", title: p.name, text: `${p.org} - ${p.groups.join(", ")}`, tags: p.groups, route: "pessoas" })),
      ...mock.opportunities.map((o) => ({ type: "Oportunidade", title: o.title, text: `${o.group} - ${o.priority}`, tags: [o.priority], route: "oportunidades" }))
    ];
    const terms = q.split(/\s+/).filter(Boolean);
    const results = rows.filter((item) => {
      const text = `${item.title} ${item.text} ${(item.tags || []).join(" ")}`.toLowerCase();
      return !terms.length || terms.some((term) => text.includes(term));
    });
    send(res, 200, JSON.stringify({ query: q, count: results.length, results: results.slice(0, 12) }));
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
