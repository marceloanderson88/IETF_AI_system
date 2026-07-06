export const groups = [
  { id: 't2trg', acronym: 'T2TRG', name: 'Thing-to-Thing Research Group', kind: 'IRTF', color: '#0ea5a4', activity: 'Alta', drafts: 6, people: 68, description: 'Pesquisa comunicacao entre coisas, privacidade, telemetria e ambientes restritos.', tags: ['IoT', 'Telemetria', 'Privacidade'], url: 'https://datatracker.ietf.org/rg/t2trg/about/' },
  { id: 'gaia', acronym: 'GAIA', name: 'Global Access to the Internet for All', kind: 'IRTF', color: '#149a49', activity: 'Alta', drafts: 8, people: 91, description: 'Promove acesso universal, inclusao digital e infraestrutura aberta.', tags: ['Inclusao', 'Acesso', 'Sustentabilidade'], url: 'https://datatracker.ietf.org/rg/gaia/about/' },
  { id: 'cfrg', acronym: 'CFRG', name: 'Crypto Forum Research Group', kind: 'IRTF', color: '#143b78', activity: 'Muito alta', drafts: 12, people: 113, description: 'Pesquisa criptografia aplicada, seguranca de protocolos e privacidade.', tags: ['Seguranca', 'Criptografia'], url: 'https://datatracker.ietf.org/rg/cfrg/about/' },
  { id: 'dinrg', acronym: 'DINRG', name: 'Decentralized Internet Research Group', kind: 'IRTF', color: '#8c249b', activity: 'Media', drafts: 7, people: 52, description: 'Explora governanca e arquiteturas para uma Internet descentralizada.', tags: ['Descentralizacao', 'Governanca'], url: 'https://datatracker.ietf.org/rg/dinrg/about/' },
  { id: 'core', acronym: 'CoRE', name: 'Constrained RESTful Environments', kind: 'IETF', color: '#138a76', activity: 'Alta', drafts: 9, people: 86, description: 'WG de protocolos RESTful para redes e dispositivos restritos.', tags: ['IETF', 'CoAP', 'Constrained'], url: 'https://datatracker.ietf.org/wg/core/about/' },
  { id: 'nmrg', acronym: 'NMRG', name: 'Network Management Research Group', kind: 'IRTF', color: '#2763d3', activity: 'Media', drafts: 5, people: 74, description: 'Pesquisa gestao, medicao, automacao e operacao de redes.', tags: ['Operacao', 'Medicao'], url: 'https://datatracker.ietf.org/rg/nmrg/about/' }
];

export const opportunities = [
  { id: 'o1', title: 'Comentar rascunho do T2TRG antes do interim', priority: 'Alta', group: 'T2TRG', evidence: 18, action: 'Ler contexto', tone: 'danger' },
  { id: 'o2', title: 'Preparar contribuicao para o CoRE', priority: 'Media', group: 'CoRE', evidence: 12, action: 'Criar rascunho', tone: 'success' },
  { id: 'o3', title: 'Ler nova thread no GAIA', priority: 'Media', group: 'GAIA', evidence: 7, action: 'Abrir pacote', tone: 'info' },
  { id: 'o4', title: 'Contactar autor ponte sobre privacidade em IoT', priority: 'Baixa', group: 'T2TRG + CoRE', evidence: 5, action: 'Ver pessoa', tone: 'bridge' }
];

export const evidence = [
  { id: 'e1', source: 'T2TRG - Charter', group: 'T2TRG', type: 'Charter', confidence: .86, quote: 'Privacidade, seguranca e confianca na coleta, processamento e troca de dados de telemetria entre coisas.', url: 'https://datatracker.ietf.org/doc/charter-irtf-t2trg/' },
  { id: 'e2', source: 'CoRE - Draft', group: 'CoRE', type: 'Internet-Draft', confidence: .83, quote: 'Seguranca e privacidade em ambientes restritos, incluindo OAuth 2.0 para dispositivos.', url: 'https://datatracker.ietf.org/wg/core/documents/' },
  { id: 'e3', source: 'GAIA - Material de reuniao', group: 'GAIA', type: 'Reuniao', confidence: .78, quote: 'Discussao sobre privacidade em IoT de baixo custo e coleta minima de dados pessoais.', url: 'https://datatracker.ietf.org/rg/gaia/meetings/' },
  { id: 'e4', source: 'RFC 9552', group: 'CoRE', type: 'RFC', confidence: .82, quote: 'Metricas e requisitos em dispositivos com recursos limitados.', url: 'https://www.rfc-editor.org/' }
];

export const watches = [
  { id: 'w1', title: 'Privacidade em IoT', type: 'Tema', scope: 'IRTF + IETF', groups: ['T2TRG','CoRE'], cadence: 'Diaria', channel: 'E-mail', updates: 18, status: 'Ativo' },
  { id: 'w2', title: 'Redes comunitarias', type: 'Tema', scope: 'IRTF', groups: ['GAIA','DINRG'], cadence: 'Semanal', channel: 'Painel', updates: 24, status: 'Ativo' },
  { id: 'w3', title: 'T2TRG <-> CoRE', type: 'Adjacencia', scope: 'Ponte IETF', groups: ['T2TRG','CoRE'], cadence: 'Antes de reunioes', channel: 'Digest', updates: 11, status: 'Ativo' }
];

export const adjacency = [
  { a: 'T2TRG', b: 'CoRE', score: .86, signals: ['Semantico','Citacao cruzada','Autor em comum'], summary: 'Telemetria, privacidade e operacao em ambientes restritos.' },
  { a: 'CFRG', b: 'TLS', score: .82, signals: ['Citacao cruzada','Termo raro'], summary: 'Criptografia aplicada ao transporte.' },
  { a: 'GAIA', b: 'DINRG', score: .78, signals: ['Semantico','Mencao explicita'], summary: 'Governanca, inclusao e infraestrutura descentralizada.' }
];

export const people = [
  { name: 'Laura Castro', org: 'Universitat Bremen', groups: ['CFRG','TLS','QUIC'], connected: 5, drafts: 18, strength: 'Muito alta' },
  { name: 'Rafael Pacheco', org: 'RNP', groups: ['T2TRG','CoRE','ROLL'], connected: 4, drafts: 12, strength: 'Alta' },
  { name: 'Mariana Farias', org: 'NIC.br', groups: ['GAIA','HIP','ICANN'], connected: 4, drafts: 11, strength: 'Alta' }
];

export const reading = ['Charter do T2TRG', 'RFC 9174 - Things Directory', 'draft-irtf-t2trg-telemetry-privacy-02', 'Threads relevantes', 'Materiais do IRTF 120'];
export const notifications = ['Novo rascunho atualizado em T2TRG', 'Janela de comentarios aberta em CoRE', 'Tema de inclusao digital em crescimento', 'Datatracker sincronizado'];
