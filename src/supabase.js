// Cliente Supabase e acesso a dados do catalogo.
// O cliente e carregado sob demanda a partir de um CDN ESM para nao bloquear
// o primeiro paint. Qualquer falha (rede/CDN) cai no fallback de dados-semente.

import { adjacency as seedAdjacency, evidence as seedEvidence, groups as seedGroups } from './data.js';

const SUPABASE_URL = 'https://lnikscxmhcrjbwxzspbj.supabase.co';
// Chave publishable: segura para o cliente, protegida por RLS no servidor.
const SUPABASE_KEY = 'sb_publishable_fmW-ZogHpyoo8NvcsRjs3A_nFwEdyxi';

let clientPromise;
async function getClient() {
  if (!clientPromise) {
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY));
  }
  return clientPromise;
}

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
const normEvidence = (r, idMap) => ({
  id: r.id, source: idMap[r.group_id] || 'IETF', group: idMap[r.group_id] || '',
  type: r.source_type, confidence: Number(r.confidence) || 0,
  quote: r.excerpt, url: r.evidence_url
});
const normAdjacency = (r, idMap) => ({
  a: idMap[r.group_a] || '?', b: idMap[r.group_b] || '?',
  score: Number(r.weight) || Number(r.confidence) || 0,
  signals: r.signal_types || [],
  summary: (r.signal_types || []).join(', ')
});

// Carrega grupos, evidencias e adjacencias reais. Em caso de erro ou base
// vazia, devolve os dados-semente para manter a demo funcional (online:false).
export async function fetchCatalog() {
  const seed = { groups: seedGroups, evidence: seedEvidence, adjacency: seedAdjacency, online: false };
  try {
    const supabase = await getClient();
    const { data: gRows, error: gErr } = await supabase
      .from('groups')
      .select('id,acronym,name,ecosystem,description,charter_url,status,tags')
      .order('ecosystem');
    if (gErr || !gRows || !gRows.length) return seed;

    const idMap = Object.fromEntries(gRows.map((r) => [r.id, r.acronym]));
    const groups = gRows.map(normGroup);

    let evidence = seedEvidence;
    const { data: eRows } = await supabase
      .from('evidence')
      .select('id,source_type,excerpt,confidence,evidence_url,group_id')
      .order('confidence', { ascending: false });
    if (eRows && eRows.length) evidence = eRows.map((r) => normEvidence(r, idMap));

    let adjacency = seedAdjacency;
    const { data: aRows } = await supabase
      .from('adjacency_edges')
      .select('group_a,group_b,signal_types,weight,confidence');
    if (aRows && aRows.length) adjacency = aRows.map((r) => normAdjacency(r, idMap));

    return { groups, evidence, adjacency, online: true };
  } catch {
    return seed;
  }
}

export async function getSession() {
  try {
    const supabase = await getClient();
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}

export async function signIn(email, password) {
  const supabase = await getClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password) {
  const supabase = await getClient();
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  try {
    const supabase = await getClient();
    await supabase.auth.signOut();
  } catch { /* ignore */ }
}

export async function onAuthStateChange(cb) {
  try {
    const supabase = await getClient();
    supabase.auth.onAuthStateChange((_event, session) => cb(session));
  } catch { /* ignore */ }
}

export async function upsertProfile(user, locale) {
  try {
    const supabase = await getClient();
    await supabase.from('profiles').upsert(
      { id: user.id, full_name: (user.email || 'user').split('@')[0], locale },
      { onConflict: 'id' }
    );
  } catch { /* ignore */ }
}
