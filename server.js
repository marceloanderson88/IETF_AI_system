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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

async function supabaseSelect(table, params = {}, key = SUPABASE_KEY) {
  if (!SUPABASE_URL || !key) throw new Error("supabase_not_configured");
  const u = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  const r = await fetch(u, {
    headers: { accept: "application/json", apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!r.ok) throw new Error(`${table}_${r.status}`);
  return r.json();
}

const GROUP_META = {
  CFRG: ["Crypto Forum Research Group", "Criptografia aplicada, seguranca de protocolos e privacidade.", ["Criptografia", "Seguranca"]],
  DINRG: ["Decentralized Internet Research Group", "Governanca, identidade e arquiteturas para uma Internet descentralizada.", ["Descentralizacao", "Governanca"]],
  GAIA: ["Global Access to the Internet for All", "Inclusao digital, acesso universal e infraestrutura comunitaria.", ["Inclusao", "Acesso"]],
  HRPC: ["Human Rights Protocol Considerations", "Impactos de protocolos em direitos humanos e liberdade na Internet.", ["Direitos humanos", "Politicas"]],
  ICCRG: ["Internet Congestion Control Research Group", "Controle de congestionamento, desempenho e equidade de transporte.", ["Transporte", "Medicao"]],
  ICNRG: ["Information-Centric Networking Research Group", "Redes orientadas a informacao, cache e arquitetura.", ["Arquitetura", "Conteudo"]],
  MAPRG: ["Measurement and Analysis for Protocols Research Group", "Medicao, analise de trafego e observabilidade de protocolos.", ["Medicao", "Analise"]],
  NMRG: ["Network Management Research Group", "Gestao, automacao, operacao e medicao de redes.", ["Operacao", "Automacao"]],
  PANRG: ["Path Aware Networking Research Group", "Selecao de caminhos, propriedades de rede e transporte consciente.", ["Roteamento", "Transporte"]],
  PEARG: ["Privacy Enhancements and Assessments Research Group", "Aprimoramentos e avaliacoes de privacidade em tecnologias da Internet.", ["Privacidade", "Avaliacao"]],
  QIRG: ["Quantum Internet Research Group", "Arquiteturas, protocolos e casos de uso para Internet quantica.", ["Quantum", "Arquitetura"]],
  RASPRG: ["Research and Analysis of Standard-Setting Processes Research Group", "Pesquisa sobre processos de padronizacao e governanca.", ["Padronizacao", "Governanca"]],
  T2TRG: ["Thing-to-Thing Research Group", "IoT, telemetria, descoberta, seguranca e comunicacao entre coisas.", ["IoT", "Telemetria", "Privacidade"]],
  UFMRG: ["Usable Formal Methods Research Group", "Metodos formais utilizaveis para protocolos e sistemas.", ["Metodos formais", "Verificacao"]]
};

function includesQuery(row, q, fields) {
  const terms = String(q || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((x) => x.length > 2);
  if (!terms.length) return true;
  const hay = fields.map((f) => row[f] || "").join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return terms.some((t) => hay.includes(t));
}

function searchRank(row, q, fields) {
  const terms = String(q || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((x) => x.length > 2);
  const hay = fields.map((f) => row[f] || "").join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return terms.reduce((score, t) => score + (hay.includes(t) ? 1 : 0), 0) || 0.1;
}

async function buildKnowledgeSearch(q) {
  const [docs, rfcs, materials, mails] = await Promise.all([
    supabaseSelect("datatracker_documents", { select: "name,title,document_type,group_acronym,state,abstract,url,updated_at", limit: 250, order: "updated_at.desc.nullslast" }),
    supabaseSelect("rfc_index", { select: "rfc_number,title,doc_id,status,pub_date,url", limit: 250, order: "rfc_number.desc" }),
    supabaseSelect("meeting_materials", { select: "material_id,title,material_type,group_acronym,url,uploaded_at", limit: 250 }),
    supabaseSelect("mail_messages", { select: "message_id,list_name,subject,snippet,url,sent_at", limit: 100 })
  ]);

  const groups = Object.entries(GROUP_META).map(([acronym, [name, description, tags]]) => ({
    type: "Grupo", title: `${acronym} - ${name}`, text: description, tags: [acronym, ...tags], route: "grupos", rank: searchRank({ title: `${acronym} ${name}`, text: description, tags: tags.join(" ") }, q, ["title", "text", "tags"])
  }));
  const docRows = docs.filter((d) => includesQuery(d, q, ["name", "title", "abstract", "group_acronym"])).map((d) => ({
    type: "Documento", title: d.title || d.name, text: d.abstract || `${d.document_type || "Documento"} do Datatracker`, tags: [d.group_acronym, d.document_type, d.state].filter(Boolean), route: "evidencias", url: d.url, rank: searchRank(d, q, ["name", "title", "abstract", "group_acronym"])
  }));
  const rfcRows = rfcs.filter((r) => includesQuery(r, q, ["doc_id", "title", "status"])).map((r) => ({
    type: "Documento", title: `${r.doc_id || `RFC ${r.rfc_number}`} - ${r.title}`, text: `RFC ${r.rfc_number}${r.status ? ` · ${r.status}` : ""}`, tags: ["RFC"], route: "evidencias", url: r.url, rank: searchRank(r, q, ["doc_id", "title", "status"])
  }));
  const meetingRows = materials.filter((m) => includesQuery(m, q, ["title", "group_acronym", "material_type"])).map((m) => ({
    type: "Reuniao", title: m.title, text: m.material_type || "Material de reuniao", tags: [m.group_acronym, m.material_type].filter(Boolean), route: "acompanhamentos", url: m.url, rank: searchRank(m, q, ["title", "group_acronym", "material_type"])
  }));
  const mailRows = mails.filter((m) => includesQuery(m, q, ["subject", "snippet", "list_name"])).map((m) => ({
    type: "Evidencia", title: m.subject || `Mensagem ${m.list_name}`, text: m.snippet || "Mensagem da lista de e-mail", tags: [String(m.list_name || "").toUpperCase(), "Lista"], route: "evidencias", url: m.url, rank: searchRank(m, q, ["subject", "snippet", "list_name"])
  }));
  return [...groups.filter((g) => includesQuery({ title: g.title, text: g.text, tags: g.tags.join(" ") }, q, ["title", "text", "tags"])), ...docRows, ...rfcRows, ...meetingRows, ...mailRows]
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 40);
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

  if (url.pathname === "/api/catalog") {
    try {
      const [docs, materials, mails] = await Promise.all([
        supabaseSelect("datatracker_documents", { select: "name,title,document_type,group_acronym,state,abstract,url,updated_at", limit: 500 }),
        supabaseSelect("meeting_materials", { select: "material_id,title,material_type,group_acronym,url", limit: 250 }),
        supabaseSelect("mail_messages", { select: "message_id,list_name,subject,snippet,url", limit: 80 })
      ]);
      const byGroup = new Map();
      for (const d of docs) {
        const g = String(d.group_acronym || "").toUpperCase();
        if (!g) continue;
        byGroup.set(g, { docs: (byGroup.get(g)?.docs || 0) + 1, materials: byGroup.get(g)?.materials || 0, mails: byGroup.get(g)?.mails || 0 });
      }
      for (const m of materials) {
        const g = String(m.group_acronym || "").toUpperCase();
        if (!g) continue;
        byGroup.set(g, { docs: byGroup.get(g)?.docs || 0, materials: (byGroup.get(g)?.materials || 0) + 1, mails: byGroup.get(g)?.mails || 0 });
      }
      for (const m of mails) {
        const g = String(m.list_name || "").toUpperCase();
        if (!g) continue;
        byGroup.set(g, { docs: byGroup.get(g)?.docs || 0, materials: byGroup.get(g)?.materials || 0, mails: (byGroup.get(g)?.mails || 0) + 1 });
      }
      const groups = Object.entries(GROUP_META).map(([acronym, [name, description, tags]]) => {
        const stats = byGroup.get(acronym) || { docs: 0, materials: 0, mails: 0 };
        const activityCount = stats.docs + stats.materials + stats.mails;
        return {
          acronym,
          name,
          kind: "IRTF",
          ecosystem: "IRTF",
          description,
          tags,
          status: activityCount ? "ativo" : "sem dados recentes",
          drafts: stats.docs,
          people: Math.max(12, stats.materials + 8),
          activity: activityCount > 30 ? "Muito alta" : activityCount > 10 ? "Alta" : activityCount > 0 ? "Media" : "Baixa",
          charter_url: `https://datatracker.ietf.org/rg/${acronym.toLowerCase()}/about/`
        };
      });
      const evidence = [
        ...docs.slice(0, 28).map((d) => ({
          source: d.title || d.name,
          group: String(d.group_acronym || "IETF").toUpperCase(),
          type: d.document_type || "Documento",
          confidence: 0.72,
          quote: d.abstract || `${d.name} indexado no Datatracker.`,
          url: d.url
        })),
        ...materials.slice(0, 16).map((m) => ({
          source: m.title,
          group: String(m.group_acronym || "IETF").toUpperCase(),
          type: "Reuniao",
          confidence: 0.68,
          quote: `${m.material_type || "Material"} de reuniao conectado ao grupo.`,
          url: m.url
        })),
        ...mails.slice(0, 12).map((m) => ({
          source: m.subject || `Lista ${m.list_name}`,
          group: String(m.list_name || "IETF").toUpperCase(),
          type: "Lista",
          confidence: 0.58,
          quote: m.snippet || "Discussao da lista de e-mail.",
          url: m.url
        }))
      ];
      const activeGroups = groups.filter((g) => (byGroup.get(g.acronym)?.docs || 0) > 0).slice(0, 8);
      const adjacency = [];
      for (let i = 0; i < activeGroups.length - 1; i++) {
        const a = activeGroups[i];
        const b = activeGroups[i + 1];
        adjacency.push({
          a: a.acronym,
          b: b.acronym,
          score: Math.min(0.9, 0.45 + ((a.drafts + b.drafts) / 160)),
          signals: ["Documentos recentes", "Materiais Datatracker"],
          summary: `${a.acronym} e ${b.acronym} aparecem no corpus inicial carregado do Datatracker.`
        });
      }
      send(res, 200, JSON.stringify({ groups, evidence, adjacency, online: true, counts: { docs: docs.length, materials: materials.length, mails: mails.length } }));
    } catch (err) {
      send(res, 200, JSON.stringify({ ...mock, online: false, error: String((err && err.message) || err) }));
    }
    return;
  }

  if (url.pathname === "/api/discover") {
    const q = url.searchParams.get("q") || "";
    try {
      const rows = await buildKnowledgeSearch(q);
      const groupRows = rows.filter((r) => r.type === "Grupo").slice(0, 6);
      const candidates = groupRows.map((r) => {
        const acronym = (r.tags || [])[0];
        return {
          acronym,
          name: r.title.split(" - ").slice(1).join(" - ") || r.title,
          ecosystem: "IRTF",
          score: Math.min(95, Math.round(58 + (r.rank * 12))),
          snippet: r.text,
          url: `https://datatracker.ietf.org/rg/${String(acronym || "").toLowerCase()}/about/`,
          evidence: rows.filter((x) => (x.tags || []).includes(acronym) && x.type !== "Grupo").slice(0, 3).map((x) => ({ snippet: x.text, url: x.url }))
        };
      });
      send(res, 200, JSON.stringify({ query: q, engine: "supabase-corpus", generated_at: new Date().toISOString(), candidates }));
    } catch (err) {
      send(res, 200, JSON.stringify({ query: q, engine: "unavailable", candidates: null, error: String((err && err.message) || err) }));
    }
    return;
  }

  if (url.pathname === "/api/search") {
    const q = url.searchParams.get("q") || "";
    try {
      const results = await buildKnowledgeSearch(q);
      send(res, 200, JSON.stringify({ query: q, engine: "supabase-corpus", count: results.length, results: results.slice(0, 30) }));
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      send(res, 200, JSON.stringify({ ok: false, error: "service_role_not_configured", hint: "Set SUPABASE_SERVICE_ROLE_KEY on the server to enable Datatracker sync." }));
      return;
    }
    const type = (url.searchParams.get("type") || "rg").toLowerCase(); // rg | wg | all
    try {
      const types = type === "all" ? ["rg", "wg"] : [type];
      const payload = [];
      const evidencePayload = [];
      for (const t of types) {
        const ecosystem = t === "rg" ? "IRTF" : "IETF";
        const upstream = await fetch(`https://datatracker.ietf.org/api/v1/group/group/?state__slug=active&type__slug=${t}&limit=1000&format=json`);
        if (!upstream.ok) throw new Error(`datatracker_${upstream.status}`);
        const data = await upstream.json();
        for (const o of (data.objects || [])) {
          if (!o.acronym || !o.name) continue;
          const rawDesc = (o.description || "").trim();
          const charterUrl = `https://datatracker.ietf.org/group/${o.acronym}/about/`;
          payload.push({
            acronym: o.acronym,
            name: o.name,
            ecosystem,
            description: rawDesc || o.name,
            charter_url: charterUrl
          });
          // Real evidence only where Datatracker gives substantive charter text.
          if (rawDesc.length >= 40) {
            evidencePayload.push({ acronym: o.acronym, excerpt: rawDesc.slice(0, 600), url: charterUrl });
          }
        }
      }
      const upserted = await supabaseRpc("sync_groups", { payload }, SUPABASE_SERVICE_KEY);
      const evidence = await supabaseRpc("sync_evidence", { payload: evidencePayload }, SUPABASE_SERVICE_KEY);
      send(res, 200, JSON.stringify({ ok: true, source: "datatracker", types, fetched: payload.length, upserted, evidence, synced_at: new Date().toISOString() }));
    } catch (err) {
      send(res, 200, JSON.stringify({ ok: false, error: String((err && err.message) || err) }));
    }
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
