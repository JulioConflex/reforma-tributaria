import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const [{ data: cron }, { data: set }, { data: est }] = await Promise.all([
    supabase.from("config_cronograma").select("ano,cbs_percentual,ibs_percentual,ibs_fator,icms_fator,iss_fator,pis_cofins_ativo,aliquotas_provisorias"),
    supabase.from("config_setores").select("setor_id,reducao_aliquota,is_estimado,iss_padrao"),
    supabase.from("config_estados").select("uf,icms_interno"),
  ]);

  const cronograma: Record<string, Record<string, unknown>> = {};
  for (const row of cron ?? []) {
    const { ano, ...fields } = row as { ano: number } & Record<string, unknown>;
    cronograma[String(ano)] = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== null)
    );
  }

  const setores: Record<string, Record<string, unknown>> = {};
  for (const row of set ?? []) {
    const { setor_id, ...fields } = row as { setor_id: string } & Record<string, unknown>;
    setores[setor_id] = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== null)
    );
  }

  const estados: Record<string, number> = {};
  for (const row of est ?? []) {
    const { uf, icms_interno } = row as { uf: string; icms_interno: number };
    estados[uf] = icms_interno;
  }

  return NextResponse.json({ cronograma, setores, estados });
}
