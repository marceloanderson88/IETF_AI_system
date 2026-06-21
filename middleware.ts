import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Mantém a sessão do Supabase Auth fresca em cada request (padrão @supabase/ssr).
 * Não bloqueia rotas — a proteção de rota fica nos handlers/páginas que exigem auth.
 *
 * À prova de falhas: se as env vars não estiverem configuradas, ou se a renovação
 * de sessão falhar por qualquer motivo, a requisição simplesmente segue. O
 * middleware NUNCA deve derrubar o site (evita MIDDLEWARE_INVOCATION_FAILED).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // sem config de Supabase → não há sessão para renovar; deixa passar.
  if (!url || !anonKey) return response;

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options?: object }[]) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]),
          );
        },
      },
    });

    await supabase.auth.getUser();
  } catch {
    // renovação de sessão falhou (ex.: incompatibilidade de runtime, rede) —
    // não é fatal: a auth real acontece nos route handlers (runtime nodejs).
    return NextResponse.next({ request });
  }

  return response;
}

export const config = {
  // só onde a sessão importa (páginas autenticadas e suas APIs); evita rodar
  // o middleware — e o cliente Supabase — em todas as rotas.
  matcher: ["/torre/:path*", "/login", "/auth/:path*", "/api/watch/:path*"],
};
