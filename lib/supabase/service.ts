import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/config";

/**
 * Client com service-role: ignora RLS. NUNCA expor no browser.
 * Usado em route handlers/cron para ler o corpus sem sessão e escrever alertas.
 */
export function createServiceClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
