"use client";

import { useState } from "react";
import { API } from "./types";

interface NcmResult {
  codigo: string;
  capitulo: string;
  encontrado: boolean;
  descricao_capitulo?: string;
  categoria?: string;
  categoria_nome?: string;
  categoria_descricao?: string;
  reducao_pct?: number;
  cbs_referencia?: number;
  ibs_referencia?: number;
  cbs_efetiva?: number;
  ibs_efetiva?: number;
  is_aliquota?: number;
  is_descricao?: string;
  total_efetivo?: number;
  cst_sugerido?: string;
  observacao?: string;
  mensagem?: string;
}

interface CstItem {
  codigo: string;
  nome: string;
  descricao: string;
  quando_usar: string;
  gera_credito: boolean;
}

interface CclassTrib {
  codigo: string;
  nome: string;
  descricao: string;
  credito: string;
}

function corCategoriaBadge(cat?: string) {
  if (!cat) return "bg-ink-100 text-ink-600";
  if (cat === "ISENTO_CBN" || cat === "IMUNE") return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (["REDUZIDO_60", "FARMACEUTICO", "SAUDE", "EDUCACAO", "AGRO_INPUT"].some((c) => cat.includes(c))) {
    return "bg-blue-50 text-blue-700 border border-blue-200";
  }
  if (cat.startsWith("IS_")) return "bg-amber-50 text-amber-800 border border-amber-200";
  return "bg-ink-100 text-ink-600";
}

export default function NcmCstTab() {
  const [ncmInput, setNcmInput] = useState("");
  const [ncmResult, setNcmResult] = useState<NcmResult | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroNcm, setErroNcm] = useState<string | null>(null);

  const [cstData, setCstData] = useState<{ cst: CstItem[]; cclass_trib: CclassTrib[] } | null>(null);
  const [carregandoCst, setCarregandoCst] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"ncm" | "cst">("ncm");

  async function buscarNcm() {
    if (!ncmInput.trim()) return;
    setBuscando(true);
    setErroNcm(null);
    try {
      const r = await fetch(`${API}/ncm/${ncmInput.replace(/\D/g, "")}`);
      const data = await r.json();
      setNcmResult(data);
    } catch {
      setErroNcm("Falha ao consultar o NCM. Verifique a conexão com o servidor.");
    } finally {
      setBuscando(false);
    }
  }

  async function carregarCst() {
    if (cstData) return;
    setCarregandoCst(true);
    try {
      const r = await fetch(`${API}/cst`);
      setCstData(await r.json());
    } catch {
      // silencioso
    } finally {
      setCarregandoCst(false);
    }
  }

  function trocarAba(aba: "ncm" | "cst") {
    setAbaAtiva(aba);
    if (aba === "cst") carregarCst();
  }

  return (
    <div className="mt-7 max-w-4xl mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="rounded-2xl bg-white hairline-strong p-6">
        <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">
          Ferramentas da Reforma
        </div>
        <h2 className="font-display text-[22px] font-bold text-ink-900 leading-tight">
          NCM / NBS e CST
        </h2>
        <p className="mt-1.5 text-[13.5px] text-ink-500 leading-relaxed">
          Consulte a alíquota efetiva de CBS e IBS por código NCM, e verifique os CST corretos para os novos documentos fiscais (LC 214/2025).
        </p>
      </div>

      {/* Seletor de sub-aba */}
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        {(["ncm", "cst"] as const).map((a) => (
          <button
            key={a}
            onClick={() => trocarAba(a)}
            className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              abaAtiva === a
                ? "bg-white text-brand-700 shadow-sm"
                : "text-ink-500 hover:text-ink-800"
            }`}
          >
            {a === "ncm" ? "NCM / NBS" : "CST / cClassTrib"}
          </button>
        ))}
      </div>

      {/* Painel NCM */}
      {abaAtiva === "ncm" && (
        <div className="space-y-5">
          {/* Busca */}
          <div className="rounded-2xl bg-white hairline-strong p-6">
            <h3 className="text-[15px] font-semibold text-ink-900 mb-4">Consultar código NCM</h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={ncmInput}
                  onChange={(e) => setNcmInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscarNcm()}
                  placeholder="Ex: 02013000, 3004, 22, 87..."
                  className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-[14px] text-ink-900 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 font-mono tracking-wide"
                  maxLength={12}
                />
                <p className="text-[11.5px] text-ink-400 mt-1.5">
                  Digite o código completo (8 dígitos), posição (4 dígitos) ou capítulo (2 dígitos).
                </p>
              </div>
              <button
                onClick={buscarNcm}
                disabled={buscando || !ncmInput.trim()}
                className="px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[13.5px] font-semibold transition disabled:opacity-50 whitespace-nowrap self-start"
              >
                {buscando ? "Buscando…" : "Consultar"}
              </button>
            </div>
            {erroNcm && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-[12.5px] text-red-700">
                {erroNcm}
              </div>
            )}
          </div>

          {/* Resultado */}
          {ncmResult && (
            <div className="rounded-2xl bg-white hairline-strong p-6 space-y-5">
              {!ncmResult.encontrado ? (
                <p className="text-[13.5px] text-ink-600">{ncmResult.mensagem}</p>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-mono text-[24px] font-bold text-ink-900 tracking-widest">
                        {ncmResult.codigo}
                      </div>
                      <div className="text-[13.5px] text-ink-500 mt-0.5">
                        Capítulo {ncmResult.capitulo} — {ncmResult.descricao_capitulo}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[11.5px] font-semibold shrink-0 ${corCategoriaBadge(ncmResult.categoria)}`}>
                      {ncmResult.categoria_nome}
                    </span>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: "CBS efetiva",
                        value: `${ncmResult.cbs_efetiva?.toFixed(2)}%`,
                        sub: `Ref. ${ncmResult.cbs_referencia?.toFixed(1)}%`,
                      },
                      {
                        label: "IBS efetiva",
                        value: `${ncmResult.ibs_efetiva?.toFixed(2)}%`,
                        sub: "Estado + Município (SP ref.)",
                      },
                      {
                        label: "Redução",
                        value: `${ncmResult.reducao_pct?.toFixed(0)}%`,
                        sub: "Desconto legal",
                      },
                      {
                        label: "Total CBS+IBS",
                        value: `${ncmResult.total_efetivo?.toFixed(2)}%`,
                        sub: ncmResult.is_aliquota ? `+IS ${ncmResult.is_aliquota?.toFixed(1)}%` : "Sem IS",
                      },
                    ].map((m) => (
                      <div key={m.label} className="rounded-xl border border-ink-100 bg-ink-50 px-4 py-3">
                        <div className="text-[11px] text-ink-500 uppercase tracking-[0.08em] font-medium">
                          {m.label}
                        </div>
                        <div className="text-[20px] font-bold text-ink-900 tab-num leading-tight mt-0.5">
                          {m.value}
                        </div>
                        <div className="text-[11px] text-ink-400 mt-0.5">{m.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* CST */}
                  <div className="flex items-center gap-4 rounded-xl bg-brand-50 border border-brand-100 px-5 py-3">
                    <div className="text-[11px] uppercase tracking-[0.10em] text-brand-600 font-semibold">
                      CST sugerido
                    </div>
                    <div className="font-mono text-[22px] font-bold text-brand-800">
                      {ncmResult.cst_sugerido}
                    </div>
                    <div className="text-[12.5px] text-brand-700 ml-1 leading-snug">
                      {ncmResult.categoria_descricao}
                    </div>
                  </div>

                  {/* IS */}
                  {(ncmResult.is_aliquota ?? 0) > 0 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                      <div className="text-[12px] font-semibold text-amber-800 mb-0.5">
                        Imposto Seletivo (IS)
                      </div>
                      <div className="text-[12.5px] text-amber-700">{ncmResult.is_descricao}</div>
                    </div>
                  )}

                  <p className="text-[11.5px] text-ink-400">{ncmResult.observacao}</p>
                </>
              )}
            </div>
          )}

          {/* Tabela rápida */}
          <div className="rounded-2xl bg-white hairline-strong p-6">
            <h3 className="text-[13.5px] font-semibold text-ink-900 mb-4">
              Categorias tributárias — referência rápida
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                {
                  label: "Tributado integralmente",
                  desc: "CBS 8,8% + IBS 17,7% = 26,5%",
                  cor: "bg-ink-50 border-ink-200",
                  exemplos: "Eletrodomésticos, vestuário, serviços gerais",
                },
                {
                  label: "Redução setorial 60%",
                  desc: "CBS 3,52% + IBS 7,08% = 10,6%",
                  cor: "bg-blue-50 border-blue-200",
                  exemplos: "Saúde, educação, insumos agropecuários, medicamentos",
                },
                {
                  label: "Cesta Básica Nacional",
                  desc: "CBS 0% + IBS 0% = 0%",
                  cor: "bg-emerald-50 border-emerald-200",
                  exemplos: "Carnes, ovos, leite, arroz, feijão, trigo, sal, óleo",
                },
                {
                  label: "Com Imposto Seletivo",
                  desc: "CBS + IBS + IS (varia por produto)",
                  cor: "bg-amber-50 border-amber-200",
                  exemplos: "Cigarros, bebidas alcoólicas, veículos de passeio, minérios",
                },
              ].map((c) => (
                <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.cor}`}>
                  <div className="text-[13px] font-semibold text-ink-800">{c.label}</div>
                  <div className="text-[13px] font-bold text-ink-900 tab-num mt-0.5">{c.desc}</div>
                  <div className="text-[11.5px] text-ink-500 mt-0.5">{c.exemplos}</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-400 mt-3">
              Alíquotas de referência plenas (2033). CBS ref.: 8,8%. IBS ref. SP: 17,7%.
              Taxas transitórias se aplicam de 2026 a 2032.
            </p>
          </div>
        </div>
      )}

      {/* Painel CST */}
      {abaAtiva === "cst" && (
        <div className="space-y-5">
          {carregandoCst ? (
            <div className="text-center py-16 text-ink-400 text-[14px]">Carregando…</div>
          ) : cstData ? (
            <>
              <div className="rounded-2xl bg-white hairline-strong p-6">
                <h3 className="text-[15px] font-semibold text-ink-900 mb-1">
                  CST — Código de Situação Tributária (CBS/IBS)
                </h3>
                <p className="text-[13px] text-ink-500 mb-5">
                  Campo obrigatório nos itens de NF-e, NFS-e e CT-e a partir de 2027. Indica o tratamento tributário da operação.
                </p>
                <div className="space-y-3">
                  {cstData.cst.map((item) => (
                    <div key={item.codigo} className="rounded-xl border border-ink-100 p-4">
                      <div className="flex items-start gap-3">
                        <div className="font-mono text-[20px] font-bold text-brand-700 w-10 shrink-0 mt-0.5">
                          {item.codigo}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="text-[13.5px] font-semibold text-ink-900">{item.nome}</div>
                            <span
                              className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                item.gera_credito
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-ink-100 text-ink-500"
                              }`}
                            >
                              {item.gera_credito ? "Gera crédito" : "Sem crédito"}
                            </span>
                          </div>
                          <div className="text-[12.5px] text-ink-600 leading-relaxed mt-0.5 mb-1.5">
                            {item.descricao}
                          </div>
                          <div className="text-[12px] text-ink-500">
                            <span className="font-medium text-ink-700">Quando usar:</span>{" "}
                            {item.quando_usar}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white hairline-strong p-6">
                <h3 className="text-[15px] font-semibold text-ink-900 mb-1">
                  cClassTrib — Classificação do destinatário
                </h3>
                <p className="text-[13px] text-ink-500 mb-5">
                  Novo campo que identifica a condição fiscal do comprador para cálculo e validação do crédito de CBS/IBS.
                </p>
                <div className="space-y-3">
                  {cstData.cclass_trib.map((item) => (
                    <div key={item.codigo} className="rounded-xl border border-ink-100 p-4">
                      <div className="flex items-start gap-3">
                        <div className="font-mono text-[20px] font-bold text-brand-700 w-10 shrink-0 mt-0.5">
                          {item.codigo}
                        </div>
                        <div className="flex-1">
                          <div className="text-[13.5px] font-semibold text-ink-900 mb-0.5">{item.nome}</div>
                          <div className="text-[12.5px] text-ink-600 leading-relaxed mb-1.5">
                            {item.descricao}
                          </div>
                          <div className="text-[12px] text-ink-500">
                            <span className="font-medium text-ink-700">Crédito:</span> {item.credito}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-ink-400 text-[14px]">
              Falha ao carregar dados. Verifique o servidor.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
