import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente do Supabase para uso no SERVIDOR (Server Components, Route Handlers).
 * Lê/escreve a sessão nos cookies da requisição.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/\/+$/, ""),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado de um Server Component (não pode escrever cookie).
            // O proxy.ts cuida de refrescar a sessão — pode ignorar.
          }
        },
      },
    }
  );
}
