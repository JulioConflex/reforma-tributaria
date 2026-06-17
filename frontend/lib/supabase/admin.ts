import { createClient } from "@supabase/supabase-js";

/**
 * Cliente ADMIN do Supabase — usa a chave service_role e IGNORA o RLS.
 * Usar SOMENTE no servidor (route handlers), nunca em componentes cliente.
 * É o que permite criar usuários e alterar papéis (master/normal).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
