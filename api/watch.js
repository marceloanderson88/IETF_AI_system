export default function handler(req, res) {
  if (req.method === 'POST') return res.status(201).json({ ok: true, watch: { ...(req.body || {}), persisted: true } });
  res.status(200).json({ watches: [{ title: 'Privacidade em IoT', status: 'Ativo', updates: 18 }] });
}
