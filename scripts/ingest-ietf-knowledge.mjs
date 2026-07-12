#!/usr/bin/env node

/**
 * Local ingestion for Bussola IETF knowledge tables.
 *
 * It does not read or write public.bi_drafts. That table belongs to the
 * analytics app and is intentionally left untouched.
 *
 * Required env:
 *   SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<secret service role key>
 *
 * Optional args:
 *   --groups t2trg,gaia,cfrg,dinrg,nmrg
 *   --meetings 120,121 or --meetings 120-now
 *   --recent-docs 200
 *   --mail-limit 40
 */

const DEFAULT_GROUPS = [
  "cfrg", "dinrg", "gaia", "hrpc", "iccrg", "icnrg", "maprg", "nmrg",
  "panrg", "pearg", "qirg", "rasprg", "t2trg", "ufmrg"
];

const args = parseArgs(process.argv.slice(2));
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const groups = splitArg(args.groups) || DEFAULT_GROUPS;
const meetings = splitArg(args.meetings);
const recentDocs = Number(args["recent-docs"] || 200);
const mailLimit = Number(args["mail-limit"] || 40);

const sourceStats = new Map();
const SOURCE_DEFS = {
  "datatracker-documents": {
    slug: "datatracker-documents",
    name: "IETF Datatracker Documents API",
    source_type: "datatracker",
    url: "https://datatracker.ietf.org/api/v1/doc/document/",
    freshness_minutes: 30
  },
  "datatracker-meetings": {
    slug: "datatracker-meetings",
    name: "IETF Datatracker Meetings API",
    source_type: "meeting",
    url: "https://datatracker.ietf.org/api/v1/meeting/",
    freshness_minutes: 60
  },
  "rfc-index-xml": {
    slug: "rfc-index-xml",
    name: "RFC Editor RFC Index XML",
    source_type: "rfc",
    url: "https://www.rfc-editor.org/rfc/rfc-index.xml",
    freshness_minutes: 1440
  },
  "mailarchive-json": {
    slug: "mailarchive-json",
    name: "IETF Mail Archive",
    source_type: "email",
    url: "https://mailarchive.ietf.org",
    freshness_minutes: 30
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  console.log("Starting Bussola IETF ingestion");
  console.log("Groups:", groups.join(", "));
  console.log("bi_drafts policy: read-only / untouched");

  await ingestDatatrackerDocuments(groups, recentDocs);
  await ingestRfcIndex();
  await ingestMeetings(meetings);
  await ingestMailArchive(groups, mailLimit);
  await touchSources();

  console.log("\nDone.");
  for (const [name, stat] of sourceStats) {
    console.log(`- ${name}: seen=${stat.seen} upserted=${stat.upserted}`);
  }
}

async function ingestDatatrackerDocuments(groupAcronyms, limit) {
  const rows = [];
  for (const group of groupAcronyms) {
    let groupRows = await fetchGroupDocumentsFromApi(group, limit);
    if (!groupRows.length) {
      groupRows = await fetchGroupDocumentsFromPage(group, limit);
    }
    console.log(`  datatracker documents ${group}: ${groupRows.length}`);
    rows.push(...groupRows);
  }
  const uniqueRows = uniqueBy(rows.filter(Boolean), (row) => row.name);
  await upsert("datatracker_documents", uniqueRows, "name");
  record("datatracker-documents", uniqueRows.length, uniqueRows.length);
}

async function ingestRfcIndex() {
  const xml = await getText("https://www.rfc-editor.org/rfc/rfc-index.xml");
  const entries = [...xml.matchAll(/<rfc-entry>([\s\S]*?)<\/rfc-entry>/g)].map((m) => m[1]);
  const rows = entries.map((entry) => {
    const docId = textTag(entry, "doc-id");
    const number = Number((docId || "").replace(/^RFC/i, ""));
    if (!number) return null;
    const year = textTag(entry, "year");
    const month = textTag(entry, "month");
    const day = textTag(entry, "day") || "01";
    const pubDate = year ? `${year}-${monthNumber(month)}-${String(day).padStart(2, "0")}` : null;
    return clean({
      rfc_number: number,
      title: textTag(entry, "title") || `RFC ${number}`,
      doc_id: docId,
      stream: textTag(entry, "stream"),
      area: textTag(entry, "area"),
      status: textTag(entry, "current-status") || textTag(entry, "publication-status"),
      pub_date: pubDate,
      url: `https://www.rfc-editor.org/rfc/rfc${number}.html`,
      metadata: {
        obsoletes: tags(entry, "obsoletes").map((x) => textTag(x, "doc-id")).filter(Boolean),
        updates: tags(entry, "updates").map((x) => textTag(x, "doc-id")).filter(Boolean),
        authors: tags(entry, "author").map((x) => ({
          name: textTag(x, "name"),
          email: textTag(x, "email")
        })).filter((x) => x.name || x.email)
      }
    });
  }).filter(Boolean);
  await upsert("rfc_index", rows, "rfc_number");
  record("rfc-index-xml", rows.length, rows.length);
}

async function ingestMeetings(meetingNumbers) {
  const meetingRows = [];
  const sessionRows = [];
  const materialRows = [];
  const agendaRows = [];

  const meetingsData = await getJsonBestEffort(
    "https://datatracker.ietf.org/api/v1/meeting/meeting/?format=json&limit=20&order_by=-date"
  );
  const resolvedMeetingNumbers = resolveMeetingNumbers(meetingNumbers, meetingsData.objects || []);
  let selected = (meetingsData.objects || [])
    .filter((m) => !resolvedMeetingNumbers || resolvedMeetingNumbers.includes(String(m.number || m.meeting_num || m.number_str)))
    .slice(0, resolvedMeetingNumbers ? 100 : 4);

  if (resolvedMeetingNumbers && !selected.length) {
    selected = resolvedMeetingNumbers.map((number) => ({
      number,
      name: `IETF ${number}`,
      resource_uri: `/api/v1/meeting/meeting/${number}/`
    }));
  }

  for (const meeting of selected) {
    const number = Number(meeting.number || meeting.meeting_num || meeting.number_str);
    const meetingId = String(number || meeting.resource_uri || meeting.name);
    meetingRows.push(clean({
      meeting_id: meetingId,
      number,
      name: meeting.name || `IETF ${number}`,
      city: meeting.city,
      country: meeting.country,
      timezone: meeting.time_zone || meeting.timezone,
      starts_on: meeting.date || meeting.starts_on,
      ends_on: meeting.end_date || meeting.ends_on,
      url: number ? `https://datatracker.ietf.org/meeting/${number}/` : null,
      metadata: meeting
    }));

    const sessions = await getJsonBestEffort(
      `https://datatracker.ietf.org/api/v1/meeting/session/?format=json&limit=1000&meeting__number=${number}`
    );
    for (const session of sessions.objects || []) {
      const sessionId = stableId(session.resource_uri || `${meetingId}:${session.name || session.group || Math.random()}`);
      const groupAcronym = getAcronym(session.group || session.group_acronym || session.group__acronym);
      sessionRows.push(clean({
        session_id: sessionId,
        meeting_id: meetingId,
        group_acronym: groupAcronym,
        name: session.name || session.agenda_name || groupAcronym,
        session_type: session.type || session.session_type,
        starts_at: session.time || session.starts_at,
        ends_at: session.ends_at,
        room: session.room,
        agenda_url: number && groupAcronym ? `https://datatracker.ietf.org/meeting/${number}/materials/agenda-${groupAcronym}` : null,
        materials_url: number && groupAcronym ? `https://datatracker.ietf.org/meeting/${number}/materials/` : null,
        metadata: session
      }));
    }

    const materials = await getJsonBestEffort(
      `https://datatracker.ietf.org/api/v1/meeting/material/?format=json&limit=1000&session__meeting__number=${number}`
    );
    const materialCountBeforeFallback = materialRows.length;
    for (const material of materials.objects || []) {
      const sessionId = material.session ? stableId(material.session) : null;
      const groupAcronym = getAcronym(material.group || material.group_acronym);
      const url = absoluteDatatracker(material.document || material.url || material.external_url || material.name);
      materialRows.push(clean({
        material_id: stableId(material.resource_uri || url || `${meetingId}:${material.name}`),
        session_id: sessionId,
        meeting_id: meetingId,
        group_acronym: groupAcronym,
        title: material.title || material.name || "Meeting material",
        material_type: material.type || material.material_type,
        url,
        uploaded_at: material.time || material.uploaded_at,
        metadata: material
      }));
    }
    if (materialRows.length === materialCountBeforeFallback && number) {
      const fallbackMaterials = await fetchMeetingMaterialsFromPage(number, meetingId);
      materialRows.push(...fallbackMaterials);
    }
    const meetingMaterials = materialRows.filter((m) => m.meeting_id === meetingId);
    for (const agenda of meetingMaterials.filter(isAgendaMaterial)) {
      const items = await fetchAgendaItems(agenda, meetingId);
      agendaRows.push(...items);
    }
  }

  const uniqueMeetings = uniqueBy(meetingRows, (row) => row.meeting_id);
  const uniqueSessions = uniqueBy(sessionRows, (row) => row.session_id);
  const uniqueMaterials = uniqueBy(materialRows, (row) => row.material_id);
  const uniqueAgendaRows = uniqueBy(agendaRows, (row) => row.agenda_item_id);
  await upsert("meeting_events", uniqueMeetings, "meeting_id");
  await upsert("meeting_sessions", uniqueSessions, "session_id");
  await upsert("meeting_materials", uniqueMaterials, "material_id");
  await upsert("meeting_agenda_items", uniqueAgendaRows, "agenda_item_id");
  record("datatracker-meetings", uniqueMeetings.length + uniqueSessions.length + uniqueMaterials.length + uniqueAgendaRows.length, uniqueMeetings.length + uniqueSessions.length + uniqueMaterials.length + uniqueAgendaRows.length);
}

async function ingestMailArchive(groupAcronyms, limit) {
  const rows = [];
  for (const group of groupAcronyms) {
    const list = group.toLowerCase();
    const html = await getTextBestEffort(`https://mailarchive.ietf.org/arch/browse/${list}/`);
    if (!html) continue;
    const links = [...html.matchAll(/href="(\/arch\/msg\/[^"]+)"/g)]
      .map((m) => m[1])
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, limit);
    for (const link of links) {
      const url = `https://mailarchive.ietf.org${link}`;
      const page = await getTextBestEffort(url);
      rows.push(clean({
        message_id: stableId(url),
        list_name: list,
        subject: extractTitle(page) || `Message from ${list}`,
        sender_name: textBetween(page, "From:", "\n") || null,
        sender_email: null,
        sent_at: null,
        url,
        snippet: stripHtml(page).slice(0, 900),
        metadata: { list, link }
      }));
    }
  }
  await upsert("mail_messages", rows, "message_id");
  record("mailarchive-json", rows.length, rows.length);
}

async function touchSources() {
  const rows = [...sourceStats.keys()].map((slug) => ({
    ...(SOURCE_DEFS[slug] || {
      slug,
      name: slug,
      source_type: "external",
      url: "https://datatracker.ietf.org",
      freshness_minutes: 60
    }),
    last_synced_at: new Date().toISOString()
  }));
  await upsert("ietf_sources", rows, "slug");
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return;
  for (const batch of chunk(rows, 200)) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Prefer": "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(batch)
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase upsert failed for ${table}: ${res.status} ${body}`);
    }
  }
}

async function getJsonBestEffort(url) {
  try {
    const res = await fetch(String(url), { headers: { accept: "application/json" } });
    if (!res.ok) return { objects: [] };
    return res.json();
  } catch {
    return { objects: [] };
  }
}

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.text();
}

async function getTextBestEffort(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    return res.text();
  } catch {
    return "";
  }
}

async function fetchGroupDocumentsFromApi(group, limit) {
  const urls = [
    datatrackerApiUrl("https://datatracker.ietf.org/api/v1/doc/document/", {
      limit: Math.max(20, limit),
      group__acronym: group,
      order_by: "-time"
    }),
    datatrackerApiUrl("https://datatracker.ietf.org/api/v1/doc/document/", {
      limit: Math.max(20, limit),
      name__contains: group,
      order_by: "-time"
    })
  ];
  const rows = [];
  for (const url of urls) {
    const data = await getJsonBestEffort(url);
    for (const item of data.objects || []) {
      if (documentMatchesGroup(item, group)) rows.push(normalizeDocument(item, group));
    }
    if (rows.length) break;
  }
  return uniqueBy(rows.filter(Boolean), (row) => row.name).slice(0, limit);
}

async function fetchGroupDocumentsFromPage(group, limit) {
  const html = await getTextBestEffort(`https://datatracker.ietf.org/group/${group}/documents/`);
  if (!html) return [];
  const docs = [];
  for (const match of html.matchAll(/<a[^>]+href="\/doc\/([^"\/]+)\/"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const name = decodeHtml(match[1]);
    if (!name || !documentNameMatchesGroup(name, group)) continue;
    docs.push(clean({
      name,
      title: stripHtml(match[2]) || name,
      document_type: name.toLowerCase().startsWith("rfc") ? "rfc" : "internet-draft",
      group_acronym: group.toUpperCase(),
      state: null,
      url: `https://datatracker.ietf.org/doc/${name}/`,
      datatracker_resource: null,
      metadata: {
        source: "datatracker-group-documents-page",
        group
      }
    }));
  }
  return uniqueBy(docs, (row) => row.name).slice(0, limit);
}

async function fetchMeetingMaterialsFromPage(number, meetingId) {
  const html = await getTextBestEffort(`https://datatracker.ietf.org/meeting/${number}/materials/`);
  if (!html) return [];
  const rows = [];
  for (const match of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1]);
    const title = stripHtml(match[2]);
    if (!href || !title || !isMeetingMaterialHref(number, href)) continue;
    const url = absoluteDatatracker(href);
    rows.push(clean({
      material_id: stableId(url),
      session_id: null,
      meeting_id: meetingId,
      group_acronym: guessGroupFromMaterial(href, title),
      title,
      material_type: guessMaterialType(href, title),
      url,
      uploaded_at: null,
      metadata: {
        source: "datatracker-meeting-materials-page",
        meeting_number: number
      }
    }));
  }
  return uniqueBy(rows, (row) => row.material_id);
}

async function fetchAgendaItems(agenda, meetingId) {
  const page = await getTextBestEffort(agenda.url);
  if (!page) return [];
  const lines = textLines(page)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 6 && line.length <= 220)
    .filter((line) => !/^(agenda|minutes|session|ietf\s+\d+|meeting materials)$/i.test(line))
    .filter((line) => !/^[-=_\s]+$/.test(line));
  const rows = [];
  for (const [index, line] of lines.entries()) {
    const parsed = parseAgendaLine(line);
    if (!parsed.title || parsed.title.length < 4) continue;
    rows.push(clean({
      agenda_item_id: stableId(`${agenda.material_id}:${index}:${parsed.title}`),
      meeting_id: meetingId,
      session_id: agenda.session_id,
      group_acronym: agenda.group_acronym || guessGroupFromMaterial(agenda.url, agenda.title),
      item_order: index + 1,
      item_title: parsed.title,
      presenter: parsed.presenter,
      duration_minutes: parsed.duration,
      agenda_url: agenda.url,
      source_text: line,
      metadata: {
        source_material_id: agenda.material_id,
        source_title: agenda.title,
        parser: "line-heuristic"
      }
    }));
  }
  return uniqueBy(rows, (row) => row.agenda_item_id).slice(0, 80);
}

function normalizeDocument(item, group) {
  if (!item?.name) return null;
  return clean({
    name: item.name,
    title: item.title || item.name,
    document_type: item.type || item.type_id || item.document_type,
    stream: item.stream || item.stream_id,
    group_acronym: (group || getAcronym(item.group)).toUpperCase(),
    state: item.states || item.state,
    intended_std_level: item.intended_std_level,
    std_level: item.std_level,
    rev: item.rev,
    pages: Number(item.pages) || null,
    abstract: item.abstract,
    url: `https://datatracker.ietf.org/doc/${item.name}/`,
    datatracker_resource: item.resource_uri,
    submitted_at: item.submission_date || item.time,
    updated_at: item.time || item.expires,
    metadata: item
  });
}

function datatrackerApiUrl(base, params) {
  const url = new URL(base);
  url.searchParams.set("format", "json");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

function resolveMeetingNumbers(values, meetingsFromApi) {
  if (!values) return null;
  const latest = meetingsFromApi
    .map((m) => Number(m.number || m.meeting_num || m.number_str))
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  const out = [];
  for (const raw of values) {
    const value = String(raw).trim().toLowerCase();
    const range = value.match(/^(\d+)\s*-\s*(now|latest|atual|hoje)$/);
    if (range) {
      const start = Number(range[1]);
      const end = latest || start;
      for (let n = start; n <= end; n++) out.push(String(n));
      continue;
    }
    const numericRange = value.match(/^(\d+)\s*-\s*(\d+)$/);
    if (numericRange) {
      const start = Number(numericRange[1]);
      const end = Number(numericRange[2]);
      for (let n = Math.min(start, end); n <= Math.max(start, end); n++) out.push(String(n));
      continue;
    }
    if (/^\d+$/.test(value)) out.push(value);
  }
  return uniqueBy(out, (x) => x);
}

function documentMatchesGroup(item, group) {
  const acronym = getAcronym(item?.group || item?.group_acronym || item?.group__acronym);
  return acronym?.toLowerCase() === group.toLowerCase() || documentNameMatchesGroup(item?.name, group);
}

function documentNameMatchesGroup(name, group) {
  const text = String(name || "").toLowerCase();
  const slug = String(group || "").toLowerCase();
  return text.includes(`-${slug}-`) || text.startsWith(`draft-${slug}-`) || text.startsWith(`draft-irtf-${slug}-`) || text.startsWith(`draft-ietf-${slug}-`);
}

function isMeetingMaterialHref(number, href) {
  const text = String(href || "");
  return text.includes(`/meeting/${number}/materials/`) || text.startsWith(`/doc/`);
}

function isAgendaMaterial(material) {
  const text = `${material.title || ""} ${material.url || ""} ${material.material_type || ""}`.toLowerCase();
  return text.includes("agenda");
}

function guessGroupFromMaterial(href, title) {
  const text = `${href} ${title}`.toLowerCase();
  const match = text.match(/(?:agenda|minutes|slides)-([a-z0-9-]+)/) || text.match(/\b([a-z0-9]+rg)\b/);
  return match ? match[1].split("-")[0].toUpperCase() : null;
}

function guessMaterialType(href, title) {
  const text = `${href} ${title}`.toLowerCase();
  if (text.includes("agenda")) return "agenda";
  if (text.includes("minutes")) return "minutes";
  if (text.includes("slide")) return "slides";
  if (text.includes("recording")) return "recording";
  return "material";
}

function parseAgendaLine(line) {
  const durationMatch = line.match(/(?:^|\s)(\d{1,3})\s*(?:min|mins|minutes)\b/i);
  const duration = durationMatch ? Number(durationMatch[1]) : null;
  let title = line
    .replace(/^\d{1,2}:\d{2}\s*(?:-|–|—)?\s*/i, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s*\(\s*\d{1,3}\s*(?:min|mins|minutes)\s*\)\s*/i, " ")
    .trim();
  let presenter = null;
  const presenterMatch = title.match(/\s+(?:-|–|—)\s+([^,]{2,80})$/);
  if (presenterMatch && !/\b(draft|rfc|ietf|irtf)\b/i.test(presenterMatch[1])) {
    presenter = presenterMatch[1].trim();
    title = title.slice(0, presenterMatch.index).trim();
  }
  return { title, presenter, duration };
}

function clean(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith("--") ? argv[++i] : "true";
  }
  return out;
}

function splitArg(value) {
  if (!value) return null;
  return String(value).split(",").map((x) => x.trim()).filter(Boolean);
}

function record(name, seen, upserted) {
  const prev = sourceStats.get(name) || { seen: 0, upserted: 0 };
  sourceStats.set(name, { seen: prev.seen + seen, upserted: prev.upserted + upserted });
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function stableId(value) {
  return String(value || "").replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 240);
}

function absoluteDatatracker(value) {
  if (!value) return null;
  if (String(value).startsWith("http")) return String(value);
  if (String(value).startsWith("/")) return `https://datatracker.ietf.org${value}`;
  return `https://datatracker.ietf.org/${String(value).replace(/^\/+/, "")}`;
}

function getAcronym(value) {
  if (!value) return null;
  const raw = String(value);
  const match = raw.match(/\/group\/group\/([^/]+)\//) || raw.match(/group=([^&]+)/);
  return (match ? match[1] : raw).split("/").filter(Boolean).pop()?.toUpperCase() || null;
}

function textTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : null;
}

function tags(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"))].map((m) => m[0]);
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function decodeHtml(value) {
  return decodeXml(String(value || "")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'"));
}

function monthNumber(month) {
  const months = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
  return months[String(month || "").toLowerCase()] || "01";
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripHtml(match[1]).trim() : null;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textLines(html) {
  return decodeHtml(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<(br|p|li|tr|h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<\/(p|li|tr|h[1-6]|div|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function textBetween(text, start, end) {
  const i = String(text || "").indexOf(start);
  if (i < 0) return null;
  const j = String(text).indexOf(end, i + start.length);
  return String(text).slice(i + start.length, j < 0 ? undefined : j).trim();
}
