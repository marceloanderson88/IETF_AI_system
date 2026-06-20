import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase para o browser (Client Components). Usa a anon key — respeita RLS. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
