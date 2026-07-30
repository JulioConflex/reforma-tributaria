import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TABLE_MAP: Record<string, string> = {
  cronograma: "config_cronograma",
  setores:    "config_setores",
  estados:    "config_estados",
};

const PK_MAP: Record<string, string> = {
  cronograma: "ano",
  setores:    "setor_id",
  estados:    "uf",
};

async function exigirMaster() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }), user: null };

  const { data: perfil } = await supabase
    .from("profiles").select("papel").eq("id", user.id).single();

  if (perfil?.papel !== "master") {
    return { erro: NextResponse.json({ erro: "Acesso restrito a masters." }, { status: 403 }), user: null };
  }
  return { erro: null, user };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ categoria: string }> },
) {
  const auth = await exigirMaster();
  if (auth.erro) return auth.erro;

  const { categoria } = await params;
  const table = TABLE_MAP[categoria];
  if (!table) return NextResponse.json({ erro: "Categoria inválida." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from(table).select("*").order(PK_MAP[categoria]);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ overrides: data });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ categoria: string }> },
) {
  const auth = await exigirMaster();
  if (auth.erro) return auth.erro;

  const { categoria } = await params;
  const table = TABLE_MAP[categoria];
  if (!table) return NextResponse.json({ erro: "Categoria inválida." }, { status: 400 });

  const body = await req.json();
  const pk = PK_MAP[categoria];
  if (body[pk] === undefined || body[pk] === null) {
    return NextResponse.json({ erro: `Campo '${pk}' obrigatório.` }, { status: 400 });
  }

  const admin = createAdminClient();
  const row = { ...body, atualizado_em: new Date().toISOString(), atualizado_por: auth.user!.id };

  const { error } = await admin.from(table).upsert(row, { onConflict: pk });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ categoria: string }> },
) {
  const auth = await exigirMaster();
  if (auth.erro) return auth.erro;

  const { categoria } = await params;
  const table = TABLE_MAP[categoria];
  if (!table) return NextResponse.json({ erro: "Categoria inválida." }, { status: 400 });

  const body = await req.json();
  const pk = PK_MAP[categoria];
  if (body[pk] === undefined || body[pk] === null) {
    return NextResponse.json({ erro: `Campo '${pk}' obrigatório.` }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from(table).delete().eq(pk, body[pk]);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
