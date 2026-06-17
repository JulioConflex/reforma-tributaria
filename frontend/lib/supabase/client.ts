import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente do Supabase para uso no NAVEGADOR (componentes "use client").
 * Usa a chave pública (anon / publishable) — pode ser exposta no front.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
