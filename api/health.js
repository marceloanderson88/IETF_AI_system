export default function handler(_request, response) {
  response.status(200).json({
    ok: true,
    app: "Bussola IETF",
    supabase_url_configured: Boolean(process.env.SUPABASE_URL),
    supabase_publishable_key_configured: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
    generated_at: new Date().toISOString()
  });
}
