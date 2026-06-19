"use client";

import { useEffect, useState } from "react";
import type { Setor, ComparadorResult, ComparativoRegime } from "./types";
import { UFS, API } from "./types";
import { FieldLabel, SelectField, brl, CurrencyField, parseBRL } from "./ui";
import TransitionTimeline from "./Timeline";

interface Props {
  setores: Setor[];
  ano: number;
  setAno: (n: number) => void;
  sharedSetorId: string;
  sharedUf: string;
}

export default function ComparadorRegimes({ setores, ano, setAno, sharedSetorId, sharedUf }: Props) {
  const [valor, setValor] = useState("10.000,00");
  const [faturamento, setFaturamento] = useState("360.000,00");
  const [setorId, setSetorId] = useState(sharedSetorId || "comercio_geral");
  const [uf, setUf] = useState(sharedUf || "SP");
  const [folhaPagamento, setFolhaPagamento] = useState("");
  const [despesasMensais, setDespesasMensais] = useState("");

  const [result, setResult] = useState<ComparadorResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const setor = setores.find((s) => s.id === setorId);
  const mostrarFatorR = setor?.anexo_simples === "FATOR_R";

  useEffect(() => {
    if (setores.length === 0) return;
    const t = setTimeout(() => comparar(), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, faturamento, setorId, uf, ano, folhaPagamento, despesasMensais, setores.length]);

  const comparar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = {
        faturamento_anual: parseBRL(faturamento),
        setor_id: setorId,
        uf, ano,
        valor: parseBRL(valor),
        percentual_credito_entrada: 0.4,
      };
      if (mostrarFatorR && folhaPagamento) {
        body.folha_pagamento_mensal = parseBRL(folhaPagamento);
      }
      if (despesasMensais) {
        body.despesas_mensais = parseBRL(despesasMensais);
      }
      const res = await fetch(`${API}/comparar-regimes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erro ao comparar regimes");
      setResult(await res.json());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  };

  const disponiveis = result?.comparativo.filter((c) => c.disponivel) ?? [];
  const piorTotal = disponiveis.length ? Math.max(...disponiveis.map((c) => c.total_novo ?? 0)) : 1;

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 mt-7">
      {/* ── Form ── */}
      <aside className="rounded-2xl bg-white hairline-strong p-6 lg:p-7 lg:sticky lg:top-6 self-start">
        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold">Comparador</div>
          <h2 className="font-display text-[20px] font-bold text-ink-900 mt-0.5 leading-tight">4 regimes lado a lado</h2>
          <p className="text-[12.5px] text-ink-500 mt-1.5 leading-snug">
            Descubra qual regime paga menos imposto para o seu negócio.
          </p>
        </div>

        <div className="mb-4">
          <FieldLabel>Valor da operação típica</FieldLabel>
          <CurrencyField value={valor} onChange={setValor} />
        </div>

        <div className="mb-4">
          <FieldLabel>Faturamento anual</FieldLabel>
          <CurrencyField value={faturamento} onChange={setFaturamento} />
          <p className="text-[11.5px] text-ink-400 mt-1.5">Determina quais regimes são elegíveis.</p>
        </div>

        <div className="mb-4">
          <FieldLabel>
            Despesas médias mensais{" "}
            <span className="normal-case font-normal text-ink-400">(p/ Lucro Real)</span>
          </FieldLabel>
          <CurrencyField value={despesasMensais} onChange={setDespesasMensais} />
          <p className="text-[11.5px] text-ink-400 mt-1.5">Inclui o IRPJ/CSLL do Lucro Real na comparação (carga total).</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="col-span-2">
            <FieldLabel>Setor</FieldLabel>
            <SelectField value={setorId} onChange={setSetorId}>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </SelectField>
          </div>
          <div>
            <FieldLabel>UF</FieldLabel>
            <SelectField value={uf} onChange={setUf}>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </SelectField>
          </div>
        </div>

        {mostrarFatorR && (
          <div className="mb-4 anim-in">
            <FieldLabel>
              Folha de pagamento mensal{" "}
              <span className="normal-case font-normal text-ink-400">(opcional)</span>
            </FieldLabel>
            <CurrencyField value={folhaPagamento} onChange={setFolhaPagamento} />
            <div className="text-[11.5px] text-amber-700 mt-1.5">⚖️ Necessário p/ Fator R</div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-ink-100">
          <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400 font-semibold mb-3">Limites de faturamento</div>
          <ul className="space-y-2 text-[12px]">
            {[
              { reg: "MEI",             val: "R$ 81 mil", fits: parseBRL(faturamento) <= 81000 },
              { reg: "Simples Nacional", val: "R$ 4,8 mi", fits: parseBRL(faturamento) <= 4800000 },
              { reg: "Lucro Presumido",  val: "R$ 78 mi",  fits: parseBRL(faturamento) <= 78000000 },
              { reg: "Lucro Real",       val: "Qualquer",  fits: true },
            ].map((l) => (
              <li key={l.reg} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${l.fits ? "bg-emerald-500" : "bg-ink-300"}`} />
                  <span className={l.fits ? "text-ink-700" : "text-ink-400"}>{l.reg}</span>
                </span>
                <span className="tab-num text-ink-500">{l.val}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex items-center gap-2 text-[12px] text-ink-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400" />
          </span>
          {carregando ? "Comparando…" : "Comparação em tempo real"}
        </div>
      </aside>

      {/* ── Result ── */}
      <section className="space-y-6">
        {erro && <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{erro}</div>}

        {result && (
          <>
            <TransitionTimeline ano={ano} setAno={setAno} />

            {/* Hero — melhor regime */}
            <div className="rounded-2xl bg-white hairline overflow-hidden">
              <div className="grid lg:grid-cols-12">
                <div className="lg:col-span-7 p-7 lg:p-9 border-r border-ink-100/70">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100 text-[11px] font-semibold">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Regime mais vantajoso
                    </span>
                    <span className="text-[11.5px] text-ink-400 font-medium">em {ano} · {result.setor}</span>
                  </div>

                  {result.regime_mais_vantajoso_nome ? (
                    <>
                      <div className="font-display text-[44px] leading-[1.05] font-bold text-ink-900 tracking-tight">
                        {result.regime_mais_vantajoso_nome}
                      </div>
                      <p className="mt-3 text-[14px] text-ink-500 leading-relaxed max-w-xl">
                        {(() => {
                          const melhor = disponiveis.find((d) => d.regime === result.regime_mais_vantajoso);
                          if (!melhor || disponiveis.length < 2) return result.obs;
                          const pior = disponiveis.reduce((a, b) => ((a.total_novo ?? 0) >= (b.total_novo ?? 0) ? a : b));
                          const economiaAno = ((pior.total_novo ?? 0) - (melhor.total_novo ?? 0)) / parseBRL(valor) * parseBRL(faturamento);
                          return <>Pode economizar até <strong className="text-emerald-600 tab-num">{brl(economiaAno)}/ano</strong> em comparação com {pior.nome}, considerando seu faturamento de {brl(parseBRL(faturamento) || 0)}.</>;
                        })()}
                      </p>
                    </>
                  ) : (
                    <div className="text-ink-500 italic">Nenhum regime disponível para este setor.</div>
                  )}
                </div>

                <div className="lg:col-span-5 p-7 lg:p-9 mesh-bone">
                  <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold mb-1">Ranking de carga</div>
                  <h3 className="font-display text-[15px] font-bold text-ink-900 mb-4">Por operação de {brl(parseBRL(valor) || 0)}</h3>
                  <ul className="space-y-3">
                    {[...disponiveis].sort((a, b) => (a.total_novo ?? 0) - (b.total_novo ?? 0)).map((c, i) => {
                      const melhor = c.regime === result.regime_mais_vantajoso;
                      const w = piorTotal > 0 ? ((c.total_novo ?? 0) / piorTotal) * 100 : 0;
                      return (
                        <li key={c.regime}>
                          <div className="flex items-baseline justify-between mb-1">
                            <span className={`text-[12.5px] font-medium ${melhor ? "text-emerald-700" : "text-ink-600"}`}>
                              <span className="font-mono tab-num text-[10px] text-ink-400 mr-1">#{i + 1}</span>
                              {c.nome}
                            </span>
                            <span className={`tab-num text-[12.5px] font-semibold ${melhor ? "text-emerald-600" : "text-ink-700"}`}>
                              {brl(c.total_novo ?? 0)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-ink-100">
                            <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: melhor ? "#10B981" : "#01D1FF" }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            {/* Tabela */}
            <div className="rounded-2xl bg-white hairline overflow-hidden">
              <div className="px-6 lg:px-7 pt-6 pb-4">
                <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold mb-0.5">Comparação detalhada</div>
                <h3 className="font-display text-[17px] font-bold text-ink-900 leading-tight">Sistema atual vs reforma · por regime</h3>
                <p className="text-[11.5px] text-ink-400 mt-0.5">Carga total por operação — inclui IRPJ/CSLL.</p>
              </div>
              <div className="px-2 lg:px-4 pb-4">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-[0.08em] text-ink-400 font-semibold">
                      <th className="text-left py-2.5 px-4">Regime</th>
                      <th className="text-right py-2.5 px-4">Sistema atual</th>
                      <th className="text-right py-2.5 px-4">Novo sistema</th>
                      <th className="text-right py-2.5 px-4">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparativo.map((c) => (
                      <RegimeRow key={c.regime} c={c} melhor={c.regime === result.regime_mais_vantajoso} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-6 lg:px-7 py-5 flex gap-4">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-white shadow-sm flex items-center justify-center text-[18px]">⚠️</div>
              <div>
                <div className="font-semibold text-amber-900 text-[14px]">Comparação por carga total — inclui IRPJ/CSLL</div>
                <p className="text-[12.5px] text-amber-800 mt-1 leading-relaxed">
                  Os totais já somam <strong>IRPJ</strong> e <strong>CSLL</strong>: no Simples e no MEI eles já estão no DAS; no Lucro Presumido pela presunção legal; no Lucro Real sobre o lucro (receita − despesas).
                  {!despesasMensais && <strong> Informe as despesas médias mensais para o Lucro Real entrar com a carga completa.</strong>}
                  {" "}Estimativa informativa — confirme com seu contador.
                </p>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function RegimeRow({ c, melhor }: { c: ComparativoRegime; melhor: boolean }) {
  if (!c.disponivel) {
    return (
      <tr className="border-t border-ink-100 bg-ink-50/30">
        <td className="py-3.5 px-4">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">Vedado</span>
            <div>
              <div className="text-ink-400 line-through text-[13px]">{c.nome}</div>
              <div className="text-[11.5px] text-red-600 mt-0.5 max-w-md leading-tight">{c.motivo_indisponivel}</div>
            </div>
          </div>
        </td>
        <td colSpan={3} className="text-center text-ink-300 text-[12px]">—</td>
      </tr>
    );
  }
  const positivo = (c.diferenca ?? 0) > 0;
  return (
    <tr className={`border-t border-ink-100 transition-colors hover:bg-ink-50/40 ${melhor ? "bg-emerald-50/40" : ""}`}>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2.5">
          {melhor && <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-white">✓ Melhor</span>}
          <div>
            <div className={`text-[14px] font-semibold ${melhor ? "text-emerald-700" : "text-ink-900"}`}>{c.nome}</div>
            <div className="text-[11.5px] text-ink-500 mt-0.5">{c.descricao}</div>
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4 text-right">
        <div className="tab-num text-ink-800 font-semibold">{brl(c.total_atual ?? 0)}</div>
        <div className="text-[11px] text-ink-400 tab-num">{(c.percentual_atual ?? 0).toFixed(2)}%</div>
      </td>
      <td className="py-3.5 px-4 text-right">
        <div className={`tab-num font-bold ${melhor ? "text-emerald-700" : "text-ink-900"}`}>{brl(c.total_novo ?? 0)}</div>
        <div className="text-[11px] text-ink-400 tab-num">{(c.percentual_novo ?? 0).toFixed(2)}%</div>
        {(c.irpj_csll_estimado ?? 0) > 0 && (
          <div className="text-[10px] text-ink-400 tab-num mt-0.5">incl. IRPJ/CSLL {brl(c.irpj_csll_estimado ?? 0)}</div>
        )}
      </td>
      <td className="py-3.5 px-4 text-right">
        <div className={`tab-num font-bold ${positivo ? "text-red-600" : "text-emerald-600"}`}>
          {positivo ? "+" : ""}{brl(c.diferenca ?? 0)}
        </div>
        <div className={`text-[11px] tab-num ${positivo ? "text-red-500" : "text-emerald-500"}`}>
          {(c.diferenca_percentual ?? 0) > 0 ? "+" : ""}{(c.diferenca_percentual ?? 0).toFixed(1)}%
        </div>
      </td>
    </tr>
  );
}
