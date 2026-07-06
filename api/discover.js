export default function handler(request, response) {
  const q = String(request.query.q || "privacy telemetry constrained devices").toLowerCase();
  response.status(200).json({
    query: q,
    generated_at: new Date().toISOString(),
    candidates: [
      {
        acronym: "T2TRG",
        name: "Thing-to-Thing Research Group",
        score: q.includes("privacy") || q.includes("privacidade") ? 0.92 : 0.84,
        next_action: "Gerar pacote de leitura e acompanhar o charter",
        evidence: ["T2TRG charter", "draft-irtf-t2trg-telemetry-privacy"]
      },
      {
        acronym: "GAIA",
        name: "Global Access to the Internet for All",
        score: q.includes("inclusion") || q.includes("inclusao") ? 0.89 : 0.86,
        next_action: "Ler discussoes recentes e identificar contribuicoes",
        evidence: ["GAIA meeting materials", "Active mailing list thread"]
      },
      {
        acronym: "CoRE",
        name: "Constrained RESTful Environments",
        score: 0.78,
        next_action: "Comparar adjacencia com T2TRG",
        evidence: ["RFC 9552", "CoRE security draft"]
      }
    ]
  });
}
