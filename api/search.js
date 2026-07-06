const groups = ['T2TRG','GAIA','CFRG','DINRG','CoRE','NMRG'];
export default function handler(req, res) {
  const q = String(req.query.q || 'privacidade em IoT');
  const results = groups.map((g, i) => ({
    type: i < 2 ? 'Grupo' : i < 4 ? 'Documento' : 'Evidencia',
    title: `${g} - resultado para ${q}`,
    text: 'Resultado demonstrativo combinando Datatracker, RFCs, listas e materiais de reuniao.',
    tags: [g, 'IETF', 'IRTF'],
    route: i < 2 ? 'grupos' : 'evidencias'
  }));
  res.status(200).json({ query: q, count: results.length, results });
}
