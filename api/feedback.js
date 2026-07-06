export default function handler(req, res) {
  res.status(200).json({ ok: true, recorded_at: new Date().toISOString(), feedback: req.body || {} });
}
