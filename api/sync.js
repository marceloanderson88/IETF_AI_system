export default function handler(req, res) {
  res.status(200).json({ ok: true, source: req.query.source || 'manual', synced_at: new Date().toISOString(), indexed_records: 1245, health: 'Excelente' });
}
