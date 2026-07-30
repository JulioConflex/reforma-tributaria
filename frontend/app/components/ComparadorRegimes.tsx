"use client";

import { useEffect, useRef, useState } from "react";
import type { Setor, ComparadorResult, ComparativoRegime } from "./types";
import { UFS, API } from "./types";
import { useConfigOverrides } from "./ConfigOverridesContext";
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
  const configOverrides = useConfigOverrides();
  const [valor, setValor] = useState("");
  const [faturamento, setFaturamento] = useState("");
  const [credito, setCredito] = useState(0);
  const [setorId, setSetorId] = useState(sharedSetorId || "comercio_geral");
  const [uf, setUf] = useState(sharedUf || "SP");
  const [folhaPagamento, setFolhaPagamento] = useState("");
  const [despesasMensais, setDespesasMensais] = useState("");

  const [result, setResult] = useState<ComparadorResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // PDF modal state
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfGerado, setPdfGerado] = useState(false);
  const [pdfCarregando, setPdfCarregando] = useState(false);
  const [pdfErro, setPdfErro] = useState<string | null>(null);
  const [pdfForm, setPdfForm] = useState({
    razao_social: "",
    cnpj: "",
    regime_atual: "",
    resultado_financeiro: "",
    perfil_clientes: "",
    objetivo_estudo: [] as string[],
    contador_nome: "",
    contador_crc: "",
  });
  const modalRef = useRef<HTMLDivElement>(null);

  const setor = setores.find((s) => s.id === setorId);
  const mostrarFatorR = setor?.anexo_simples === "FATOR_R";

  useEffect(() => {
    if (setores.length === 0) return;
    const t = setTimeout(() => comparar(), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, faturamento, credito, setorId, uf, ano, folhaPagamento, despesasMensais, setores.length]);

  const comparar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = {
        faturamento_anual: parseBRL(faturamento),
        setor_id: setorId,
        uf, ano,
        valor: parseBRL(valor),
        percentual_credito_entrada: credito / 100,
        config_overrides: configOverrides,
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

  const gerarPDF = async () => {
    if (!result) return;
    setPdfCarregando(true);
    setPdfErro(null);
    try {
      const payload = {
        ...pdfForm,
        faturamento_anual: parseBRL(faturamento),
        despesas_mensais: despesasMensais ? parseBRL(despesasMensais) : null,
        comparador: result,
      };
      const res = await fetch(`${API}/gerar-estudo-tributario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Erro ao gerar PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const nome = pdfForm.razao_social.replace(/\s+/g, "_").substring(0, 40) || "Empresa";
      a.href = url;
      a.download = `Estudo_Tributario_${nome}_${result.ano}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setPdfGerado(true);
    } catch (e: unknown) {
      setPdfErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setPdfCarregando(false);
    }
  };

  const disponiveis = result?.comparativo.filter((c) => c.disponivel) ?? [];
  const piorTotal = disponiveis.length ? Math.max(...disponiveis.map((c) => c.total_novo ?? 0)) : 1;

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 mt-7 lg:items-start">
      {/* ── Form ── */}
      <aside className="rounded-2xl bg-white hairline-strong p-6 lg:p-7 lg:sticky lg:top-6 self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
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

        <div className="mb-4">
          <FieldLabel>Crédito de entrada</FieldLabel>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[13px] font-semibold text-ink-700 tab-num">{credito}%</div>
          </div>
          <input
            type="range" min={0} max={80} step={5} value={credito}
            onChange={(e) => setCredito(parseInt(e.target.value))}
            className="rng w-full"
          />
          <p className="text-[11.5px] text-ink-400 mt-1.5">% de IBS/CBS que você recupera via créditos de entradas.</p>
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
      <section className="space-y-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1 lg:pb-6">
        {erro && <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{erro}</div>}

        {result && (
          <>
            <TransitionTimeline ano={ano} setAno={setAno} />

            {result.valores_projetados && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 flex gap-3">
                <span className="text-amber-500 text-xl shrink-0 mt-0.5">⚠️</span>
                <div>
                  <p className="font-semibold text-amber-900 text-[13.5px] mb-1">
                    Resultados baseados em projeções — sujeitos a alteração
                  </p>
                  <p className="text-[12.5px] text-amber-800 leading-relaxed">
                    As alíquotas de referência do IBS (~18,7%) e CBS (~9,3%) ainda não foram confirmadas pelo Senado Federal.
                    Para <strong>Simples Nacional e MEI</strong>, o modelo exato de cobrança de IBS/CBS a partir de 2027
                    (integração ao DAS ou recolhimento separado) ainda não foi regulamentado pelo Comitê Gestor do IBS (CG-IBS).
                    Os valores exibidos são estimativas — os resultados reais poderão ser diferentes.
                  </p>
                </div>
              </div>
            )}

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
                          if (!melhor || disponiveis.length < 2 || parseBRL(valor) <= 0) return result.obs;
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
                      <RegimeRow key={c.regime} c={c} melhor={c.regime === result.regime_mais_vantajoso} ano={ano} />
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

            {/* PDF button */}
            <div className="rounded-2xl bg-white hairline px-6 lg:px-7 py-5 flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-ink-900 text-[14px]">Estudo Tributário Completo</div>
                <p className="text-[12.5px] text-ink-500 mt-0.5">
                  Gere um relatório profissional em PDF com toda a análise comparativa, memórias de cálculo e conclusão.
                </p>
              </div>
              <button
                onClick={() => { setPdfModalOpen(true); setPdfGerado(false); setPdfErro(null); }}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-[13px] font-semibold transition-colors shadow-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                Gerar PDF
              </button>
            </div>
          </>
        )}

        {/* PDF Modal */}
        {pdfModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm">
            <div
              ref={modalRef}
              className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
                <div>
                  <div className="font-display font-bold text-[17px] text-ink-900">Estudo Tributário Completo</div>
                  <div className="text-[12px] text-ink-500 mt-0.5">Preencha os dados da empresa para gerar o PDF</div>
                </div>
                <button
                  onClick={() => setPdfModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Modal body */}
              <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
                {pdfGerado && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-[13px] text-emerald-800 font-medium flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    PDF gerado e baixado com sucesso.
                  </div>
                )}
                {pdfErro && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700">{pdfErro}</div>
                )}

                {/* Identificação */}
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <div>
                    <FieldLabel>Razão Social <span className="text-red-500">*</span></FieldLabel>
                    <input
                      className="w-full border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                      placeholder="Nome completo da empresa"
                      value={pdfForm.razao_social}
                      onChange={(e) => setPdfForm((f) => ({ ...f, razao_social: e.target.value }))}
                    />
                  </div>
                  <div className="w-44">
                    <FieldLabel>CNPJ <span className="text-ink-400 font-normal">(opcional)</span></FieldLabel>
                    <input
                      className="w-full border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                      placeholder="00.000.000/0001-00"
                      value={pdfForm.cnpj}
                      onChange={(e) => setPdfForm((f) => ({ ...f, cnpj: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Regime atual */}
                <div>
                  <FieldLabel>Regime tributário atual</FieldLabel>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {[
                      { v: "mei", l: "MEI" },
                      { v: "simples_nacional", l: "Simples Nacional" },
                      { v: "lucro_presumido", l: "Lucro Presumido" },
                      { v: "lucro_real", l: "Lucro Real" },
                    ].map(({ v, l }) => (
                      <button
                        key={v}
                        onClick={() => setPdfForm((f) => ({ ...f, regime_atual: f.regime_atual === v ? "" : v }))}
                        className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium border transition-all ${
                          pdfForm.regime_atual === v
                            ? "bg-brand-500 text-white border-brand-500"
                            : "bg-white text-ink-600 border-ink-200 hover:border-brand-300 hover:text-brand-600"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resultado financeiro */}
                <div>
                  <FieldLabel>Resultado financeiro atual</FieldLabel>
                  <div className="flex gap-2 mt-1">
                    {[
                      { v: "lucrativa", l: "Lucrativa", cor: "emerald" },
                      { v: "equilibrio", l: "Em equilíbrio", cor: "amber" },
                      { v: "prejuizo", l: "Em prejuízo", cor: "red" },
                    ].map(({ v, l, cor }) => {
                      const sel = pdfForm.resultado_financeiro === v;
                      const paleta: Record<string, string> = {
                        emerald: sel ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-ink-600 border-ink-200 hover:border-emerald-300 hover:text-emerald-700",
                        amber:   sel ? "bg-amber-400 text-white border-amber-400"   : "bg-white text-ink-600 border-ink-200 hover:border-amber-300 hover:text-amber-700",
                        red:     sel ? "bg-red-500 text-white border-red-500"       : "bg-white text-ink-600 border-ink-200 hover:border-red-300 hover:text-red-600",
                      };
                      return (
                        <button
                          key={v}
                          onClick={() => setPdfForm((f) => ({ ...f, resultado_financeiro: f.resultado_financeiro === v ? "" : v }))}
                          className={`flex-1 py-1.5 rounded-lg text-[12.5px] font-medium border transition-all ${paleta[cor]}`}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Perfil de clientes */}
                <div>
                  <FieldLabel>Perfil dos clientes</FieldLabel>
                  <p className="text-[11px] text-ink-400 mb-1.5">Impacta a análise de crédito CBS/IBS cedido ao cliente.</p>
                  <div className="flex gap-2 mt-1">
                    {[
                      { v: "pf", l: "Maioria Pessoa Física", sub: "B2C" },
                      { v: "pj", l: "Maioria Pessoa Jurídica", sub: "B2B" },
                      { v: "misto", l: "Misto", sub: "PF + PJ" },
                    ].map(({ v, l, sub }) => {
                      const sel = pdfForm.perfil_clientes === v;
                      return (
                        <button
                          key={v}
                          onClick={() => setPdfForm((f) => ({ ...f, perfil_clientes: f.perfil_clientes === v ? "" : v }))}
                          className={`flex-1 py-2 rounded-lg text-[12px] font-medium border transition-all flex flex-col items-center gap-0.5 ${
                            sel ? "bg-brand-500 text-white border-brand-500" : "bg-white text-ink-600 border-ink-200 hover:border-brand-300 hover:text-brand-600"
                          }`}
                        >
                          <span>{l}</span>
                          <span className={`text-[10px] font-normal ${sel ? "text-brand-100" : "text-ink-400"}`}>{sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Objetivo */}
                <div>
                  <FieldLabel>Objetivo do estudo</FieldLabel>
                  <p className="text-[11px] text-ink-400 mb-1.5">Pode marcar mais de uma opção.</p>
                  <div className="flex flex-col gap-2 mt-1">
                    {[
                      { v: "comparar", l: "Comparar regimes disponíveis", d: "Análise neutra — qual regime paga menos?" },
                      { v: "mudanca", l: "Planejar mudança de regime", d: "Foco em viabilidade e timing de transição" },
                      { v: "reforma", l: "Avaliar impacto da Reforma Tributária", d: "Foco nos efeitos do CBS/IBS a partir de 2027" },
                    ].map(({ v, l, d }) => {
                      const sel = pdfForm.objetivo_estudo.includes(v);
                      return (
                        <button
                          key={v}
                          onClick={() => setPdfForm((f) => ({
                            ...f,
                            objetivo_estudo: sel
                              ? f.objetivo_estudo.filter((x) => x !== v)
                              : [...f.objetivo_estudo, v],
                          }))}
                          className={`w-full text-left px-4 py-2.5 rounded-xl border transition-all flex items-start gap-3 ${
                            sel ? "bg-brand-50 border-brand-400 ring-1 ring-brand-200" : "bg-white border-ink-200 hover:border-brand-200"
                          }`}
                        >
                          <span className={`mt-0.5 w-4 h-4 shrink-0 rounded flex items-center justify-center border-2 transition-all ${
                            sel ? "bg-brand-500 border-brand-500" : "border-ink-300"
                          }`}>
                            {sel && (
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <div>
                            <div className={`text-[13px] font-semibold ${sel ? "text-brand-700" : "text-ink-800"}`}>{l}</div>
                            <div className={`text-[11.5px] mt-0.5 ${sel ? "text-brand-500" : "text-ink-400"}`}>{d}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Contador */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-ink-100">
                  <div>
                    <FieldLabel>Nome do contador <span className="text-ink-400 font-normal">(opcional)</span></FieldLabel>
                    <input
                      className="w-full border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                      placeholder="Nome completo"
                      value={pdfForm.contador_nome}
                      onChange={(e) => setPdfForm((f) => ({ ...f, contador_nome: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FieldLabel>CRC <span className="text-ink-400 font-normal">(opcional)</span></FieldLabel>
                    <input
                      className="w-full border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                      placeholder="000000/O-0"
                      value={pdfForm.contador_crc}
                      onChange={(e) => setPdfForm((f) => ({ ...f, contador_crc: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="px-6 py-4 border-t border-ink-100 flex items-center justify-between gap-3 bg-ink-50/50">
                <p className="text-[11px] text-ink-400 leading-tight max-w-xs">
                  Os dados do comparador já estão incluídos. Apenas a Razão Social é obrigatória.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setPdfModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-[13px] font-medium text-ink-600 hover:bg-ink-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={gerarPDF}
                    disabled={!pdfForm.razao_social.trim() || pdfCarregando}
                    className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-ink-200 disabled:text-ink-400 text-white text-[13px] font-semibold transition-colors flex items-center gap-2"
                  >
                    {pdfCarregando ? (
                      <>
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Gerando...
                      </>
                    ) : (
                      "Baixar PDF"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function RegimeRow({ c, melhor, ano }: { c: ComparativoRegime; melhor: boolean; ano: number }) {
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
            {ano >= 2027 && (c.regime === "simples_nacional" || c.regime === "mei") && (
              <div className="text-[10.5px] text-amber-700 mt-0.5 font-medium">EST · regime híbrido estimado</div>
            )}
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
