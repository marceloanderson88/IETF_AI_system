// Acesso ao catalogo da Bussola. Em producao, os dados chegam pelo servidor
// (/api/catalog), que le o Supabase com as variaveis configuradas na Vercel.
// Qualquer falha cai no fallback de dados-semente para manter a demo funcional.

import { adjacency as seedAdjacency, evidence as seedEvidence, groups as seedGroups } from './data.js';

export const mapLocale = (l) => ({ PT: 'pt-BR', ES: 'es', EN: 'en' }[l] || 'pt-BR');

const COLORS = {
  T2TRG: '#0ea5a4', GAIA: '#149a49', CFRG: '#143b78', DINRG: '#8c249b',
  CoRE: '#138a76', NMRG: '#2763d3', TLS: '#0f766e'
};
const colorFor = (acronym) => COLORS[acronym] || '#334155';

const normGroup = (r) => ({
  id: r.id, acronym: r.acronym, name: r.name, kind: r.ecosystem,
  color: colorFor(r.acronym), description: r.description,
  tags: r.tags || [], url: r.charter_url, status: r.status
});
// Carrega grupos, evidencias e adjacencias reais. Em caso de erro ou base
// vazia, devolve os dados-semente para manter a demo funcional (online:false).
export async function fetchCatalog() {
  const seed = { groups: seedGroups, evidence: seedEvidence, adjacency: seedAdjacency, online: false };
  try {
    const res = await fetch('/api/catalog');
    const data = await res.json();
    if (data?.online === false) return seed;
    if (!data?.groups?.length) return seed;
    return {
      groups: data.groups.map(normGroup),
      evidence: data.evidence?.length ? data.evidence.map((r, i) => ({
        id: r.id || `ev-${i}`,
        source: r.source,
        group: r.group,
        type: r.type,
        confidence: Number(r.confidence) || 0,
        quote: r.quote,
        url: r.url
      })) : seedEvidence,
      adjacency: data.adjacency?.length ? data.adjacency.map((r) => ({
        a: r.a,
        b: r.b,
        score: Number(r.score) || 0,
        signals: r.signals || [],
        summary: r.summary
      })) : seedAdjacency,
      online: data.online !== false,
      counts: data.counts
    };
  } catch {
    return seed;
  }
}

export async function getSession() {
  return null;
}

export async function signIn(email, password) {
  return { data: { user: { email } }, error: null };
}

export async function signUp(email, password) {
  return { data: { user: { email } }, error: null };
}

export async function signOut() {
  return null;
}

export async function onAuthStateChange(cb) {
  cb(null);
}

export async function upsertProfile(user, locale) {
  return { user, locale };
}
