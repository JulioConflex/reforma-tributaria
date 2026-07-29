import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PAPEIS_VALIDOS = ["basico", "completo"];
const MODULOS_VALIDOS = ["tributos", "markup", "comparador", "split_payment"];

async function exigirMaster(): Promise<
  { erro: NextResponse; user: null } | { erro: null; user: User }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }), user: null };
  const { data: perfil } = await supabase.from("profiles").select("papel").eq("id", user.id).single();
  if (perfil?.papel !== "master") return { erro: NextResponse.json({ erro: "Acesso restrito a masters." }, { status: 403 }), user: null };
  return { erro: null, user };
}

export async function GET() {
  const auth = await exigirMaster();
  if (auth.erro) return auth.erro;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profile_permissions")
    .select("papel,modulo,permitido")
    .order("papel")
    .order("modulo");

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ permissoes: data });
}

export async function PATCH(req: Request) {
  const auth = await exigirMaster();
  if (auth.erro) return auth.erro;

  const { papel, modulo, permitido } = await req.json();

  if (
    !PAPEIS_VALIDOS.includes(papel) ||
    !MODULOS_VALIDOS.includes(modulo) ||
    typeof permitido !== "boolean"
  ) {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profile_permissions")
    .upsert({ papel, modulo, permitido }, { onConflict: "papel,modulo" });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
