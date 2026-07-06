export default function handler(req, res) {
  const body = req.body || {};
  const group = body.group || 'T2TRG';
  const subject = body.subject || 'Privacy and telemetry in constrained devices';
  const query = body.query || 'privacy telemetry';
  res.status(200).json({
    subject,
    body: `Dear ${group},\n\nI am reviewing ${query} and would appreciate feedback from the group.\n\nQuestions:\n- Are the assumptions aligned with current work?\n- Which drafts or RFCs should be cited?\n- Are there deployment constraints we should consider?\n\nThe current evidence package points to the T2TRG charter, related CoRE work, and recent meeting materials.\n\nBest regards,\nBussola IETF demo user`,
    evidence: ['T2TRG - Charter', 'CoRE - Draft', 'GAIA - Meeting material']
  });
}
