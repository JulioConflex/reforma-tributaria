import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Garante que quem chama está logado E é "master".
 * Retorna a resposta de erro pronta, ou o usuário autenticado.
 */
async function exigirMaster(): Promise<
  { erro: NextResponse; user: null } | { erro: null; user: User }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }), user: null };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("papel")
    .eq("id", user.id)
    .single();

  if (perfil?.papel !== "master") {
    return { erro: NextResponse.json({ erro: "Acesso restrito a masters." }, { status: 403 }), user: null };
  }

  return { erro: null, user };
}

// Lista todos os usuários (com papel).
export async function GET() {
  const auth = await exigirMaster();
  if (auth.erro) return auth.erro;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,nome,papel,criado_em")
    .order("criado_em", { ascending: true });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ usuarios: data });
}

// Cria um novo usuário (só master).
export async function POST(req: Request) {
  const auth = await exigirMaster();
  if (auth.erro) return auth.erro;

  const { email, senha, nome, papel } = await req.json();

  if (!email || !senha) {
    return NextResponse.json({ erro: "E-mail e senha são obrigatórios." }, { status: 400 });
  }
  if (String(senha).length < 8) {
    return NextResponse.json({ erro: "A senha deve ter ao menos 8 caracteres." }, { status: 400 });
  }

  const admin = createAdminClient();
  const novoPapel = papel === "master" ? "master" : "normal";
  const emailLimpo = String(email).trim();

  const { data: criado, error } = await admin.auth.admin.createUser({
    email: emailLimpo,
    password: String(senha),
    email_confirm: true, // já entra sem precisar confirmar e-mail
    user_metadata: { nome: nome ?? "", senha_trocada: false },
  });

  if (error || !criado?.user) {
    return NextResponse.json({ erro: error?.message || "Falha ao criar usuário." }, { status: 400 });
  }

  // Garante o registro do perfil com nome e papel (idempotente).
  const { error: erroPerfil } = await admin.from("profiles").upsert(
    { id: criado.user.id, email: emailLimpo, nome: nome ?? "", papel: novoPapel },
    { onConflict: "id" }
  );
  if (erroPerfil) {
    return NextResponse.json({ erro: erroPerfil.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Altera o papel (master/normal) de um usuário (só master).
export async function PATCH(req: Request) {
  const auth = await exigirMaster();
  if (auth.erro) return auth.erro;

  const { id, papel } = await req.json();

  if (!id || (papel !== "normal" && papel !== "master")) {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }
  // Evita que um master se rebaixe e perca o acesso de gestão.
  if (id === auth.user.id && papel !== "master") {
    return NextResponse.json({ erro: "Você não pode rebaixar a si mesmo." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ papel }).eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
