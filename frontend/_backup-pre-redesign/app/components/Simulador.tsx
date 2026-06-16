"use client";

import { useState, useEffect } from "react";
import type { Setor, SimulacaoResult, MarkupResult } from "./types";
import { REGIMES, UFS, API } from "./types";
import ResultadoSimulacao from "./ResultadoSimulacao";
import ComparadorRegimes from "./ComparadorRegimes";
import Onboarding from "./Onboarding";
import BannerContexto from "./BannerContexto";
import TooltipGlossario from "./TooltipGlossario";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Aba = "simulador" | "markup" | "comparador";

const CREDITO_AUTO: Record<string, number> = {
  simples_nacional: 0,
  mei: 0,
  lucro_presumido: 30,
  lucro_real: 50,
};

/* ── Conflex small brand icon (used in minor decorative contexts) ── */
function ConflexIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M34 10 A17 17 0 1 0 34 38" stroke="#01D1FF" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M29 17 A8.5 8.5 0 1 0 29 31" stroke="#01D1FF" strokeWidth="3.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Shared styles ─────────────────────────────────────────────── */
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors";
const labelCls = "block text-xs font-medium text-slate-500 mb-1";

export default function Simulador() {
  const [aba, setAba] = useState<Aba>("simulador");
  const [setores, setSetores] = useState<Setor[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<SimulacaoResult | null>(null);
  const [markupResult, setMarkupResult] = useState<MarkupResult | null>(null);

  // Simulador
  const [valor, setValor] = useState("10000");
  const [regime, setRegime] = useState("lucro_presumido");
  const [setorId, setSetorId] = useState("comercio_geral");
  const [uf, setUf] = useState("SP");
  const [ano, setAno] = useState(2026);
  const [creditoModoAvancado, setCreditoModoAvancado] = useState(false);
  const [credito, setCredito] = useState(30);
  const [faturamento, setFaturamento] = useState("360000");
  const [folhaPagamento, setFolhaPagamento] = useState("");

  // Markup
  const [custo, setCusto] = useState("5000");
  const [margem, setMargem] = useState("30");
  const [despesas, setDespesas] = useState("10");
  const [mRegime, setMRegime] = useState("lucro_presumido");
  const [mSetorId, setMSetorId] = useState("comercio_geral");
  const [mUf, setMUf] = useState("SP");
  const [mAno, setMAno] = useState(2026);
  const [mCreditoAvancado, setMCreditoAvancado] = useState(false);
  const [mCredito, setMCredito] = useState(30);

  useEffect(() => {
    fetch(`${API}/api/setores`)
      .then((r) => r.json())
      .then((d) => setSetores(d.setores))
      .catch(() =>
        setErro(
          "Não foi possível conectar ao servidor. Certifique-se de que o backend está rodando em http://localhost:8000"
        )
      );
  }, []);

  useEffect(() => {
    if (!creditoModoAvancado) setCredito(CREDITO_AUTO[regime] ?? 30);
  }, [regime, creditoModoAvancado]);

  useEffect(() => {
    if (!mCreditoAvancado) setMCredito(CREDITO_AUTO[mRegime] ?? 30);
  }, [mRegime, mCreditoAvancado]);

  const setorSelecionado = setores.find((s) => s.id === setorId);
  const meiIncompativel =
    regime === "mei" && setorSelecionado?.mei_permitido === false;
  const mostrarFatorR =
    regime === "simples_nacional" &&
    setorSelecionado?.anexo_simples === "FATOR_R";

  const simular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (meiIncompativel) return;
    setCarregando(true);
    setErro(null);
    setResultado(null);
    try {
      const body: Record<string, unknown> = {
        valor: parseFloat(valor),
        regime,
        setor_id: setorId,
        uf,
        ano,
        percentual_credito_entrada: credito / 100,
      };
      if (regime === "simples_nacional" || regime === "mei") {
        body.faturamento_anual = parseFloat(faturamento);
      }
      if (mostrarFatorR && folhaPagamento) {
        body.folha_pagamento_mensal = parseFloat(folhaPagamento);
      }
      const res = await fetch(`${API}/api/simular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Erro na simulação");
      }
      setResultado(await res.json());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  };

  const calcularMarkup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    setMarkupResult(null);
    try {
      const res = await fetch(`${API}/api/markup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custo: parseFloat(custo),
          margem_desejada: parseFloat(margem) / 100,
          despesas_fixas_percentual: parseFloat(despesas) / 100,
          regime: mRegime,
          setor_id: mSetorId,
          uf: mUf,
          ano: mAno,
          percentual_credito_entrada: mCredito / 100,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Erro no cálculo de markup");
      }
      setMarkupResult(await res.json());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  };

  const ABAS: { id: Aba; label: string }[] = [
    { id: "simulador", label: "Simulador de Tributos" },
    { id: "markup", label: "Calculadora de Preço" },
    { id: "comparador", label: "Comparar Regimes" },
  ];

  return (
    <>
      <Onboarding
        onComplete={(cfg) => {
          setRegime(cfg.regime);
          setMRegime(cfg.regime);
          setSetorId(cfg.setorId);
          setMSetorId(cfg.setorId);
          setAba(cfg.aba);
        }}
      />

      <div className="min-h-screen bg-brand-50">
        {/* ── Header Conflex ───────────────────────────────────── */}
        <header className="bg-brand-800">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img
                src="/conflex-logo.png"
                alt="Conflex"
                className="h-10 w-auto shrink-0"
              />
              <div className="hidden sm:block">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-brand-400 text-sm font-light">/</span>
                  <span className="text-brand-300 text-sm font-medium">
                    Reforma Tributária
                  </span>
                </div>
                <p className="text-brand-400 text-[11px] mt-1 leading-none">
                  LC 214/2025 ·{" "}
                  <TooltipGlossario termo="ibs">IBS</TooltipGlossario> ·{" "}
                  <TooltipGlossario termo="cbs">CBS</TooltipGlossario> ·{" "}
                  <TooltipGlossario termo="is">Imposto Seletivo</TooltipGlossario>
                </p>
              </div>
            </div>
            {/* "Como funciona" */}
            <button
              onClick={() => {
                if (typeof window !== "undefined")
                  localStorage.removeItem("onboarding_feito");
                window.location.reload();
              }}
              className="shrink-0 text-xs text-brand-300 hover:text-white border border-brand-700 hover:border-brand-400 rounded-lg px-3 py-1.5 transition-all"
            >
              ? Como funciona
            </button>
          </div>
        </header>

        {/* Banner contextual */}
        <BannerContexto />

        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* ── Abas ─────────────────────────────────────────── */}
          <div className="flex gap-1 bg-brand-100 rounded-xl p-1 w-fit mb-6 overflow-x-auto">
            {ABAS.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setAba(a.id);
                  setErro(null);
                  setResultado(null);
                  setMarkupResult(null);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  aba === a.id
                    ? "bg-white text-brand-800 shadow-sm"
                    : "text-brand-600 hover:text-brand-800"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* ── SIMULADOR ─────────────────────────────────────── */}
          {aba === "simulador" && (
            <form
              onSubmit={simular}
              className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm"
            >
              <h2 className="font-semibold text-brand-800 mb-1">
                Dados da operação
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Informe os dados abaixo para calcular quanto sua empresa paga de
                imposto hoje e quanto pagará com a reforma.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Valor da operação (R$)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className={inputCls}
                    required
                  />
                  <div className="text-xs text-slate-400 mt-1">
                    Ex: valor de uma venda ou serviço
                  </div>
                </div>

                <div>
                  <label className={labelCls}>
                    <TooltipGlossario termo="lucro_presumido">
                      Regime tributário
                    </TooltipGlossario>
                  </label>
                  <select
                    value={regime}
                    onChange={(e) => {
                      setRegime(e.target.value);
                      setCreditoModoAvancado(false);
                    }}
                    className={inputCls}
                  >
                    {REGIMES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {regime === "simples_nacional" && (
                    <div className="text-xs text-slate-400 mt-1">
                      Faturamento até R$ 4,8 milhões/ano
                    </div>
                  )}
                  {regime === "mei" && !meiIncompativel && (
                    <div className="text-xs text-slate-400 mt-1">
                      Autônomo com faturamento até R$ 81 mil/ano
                    </div>
                  )}
                  {meiIncompativel && (
                    <div className="mt-2 rounded-lg bg-red-50 border border-red-300 px-3 py-2 text-xs text-red-800">
                      <span className="font-semibold">⛔ MEI não permitido para esta atividade.</span>{" "}
                      {setorSelecionado?.mei_conselho
                        ? `Profissão regulamentada pelo ${setorSelecionado.mei_conselho}.`
                        : setorSelecionado?.mei_restricao === "escala_industrial"
                        ? "Atividade de escala industrial."
                        : "Atividade vedada pelo CGSN 140/2018."}
                      {" "}Selecione outro regime.
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Setor de atividade</label>
                  <select
                    value={setorId}
                    onChange={(e) => setSetorId(e.target.value)}
                    className={inputCls}
                  >
                    {setores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                  {(setores.find((s) => s.id === setorId)?.reducao_aliquota ?? 0) > 0 && (
                    <div className="text-xs text-brand-500 mt-1 font-medium">
                      ✓ Redução de{" "}
                      {(setores.find((s) => s.id === setorId)!.reducao_aliquota * 100).toFixed(0)}%
                      {" "}no novo imposto
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelCls}>UF de destino</label>
                  <select
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    className={inputCls}
                  >
                    {UFS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>
                    Ano-referência:{" "}
                    <strong className="text-brand-700">{ano}</strong>
                  </label>
                  <input
                    type="range"
                    min={2026}
                    max={2033}
                    value={ano}
                    onChange={(e) => setAno(parseInt(e.target.value))}
                    className="w-full mt-2 accent-brand-400"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>2026 (testes)</span>
                    <span>2033 (pleno)</span>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>
                    <TooltipGlossario termo="credito_entrada">
                      Crédito de entradas
                    </TooltipGlossario>
                  </label>
                  {!creditoModoAvancado ? (
                    <div className="rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-xs text-brand-700">
                      Estimado automaticamente:{" "}
                      <strong>{CREDITO_AUTO[regime] ?? 30}%</strong>
                      {regime === "simples_nacional" || regime === "mei" ? (
                        <span className="text-slate-400"> (Simples não tem crédito)</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setCreditoModoAvancado(true)}
                        className="ml-2 text-brand-500 hover:text-brand-700 underline"
                      >
                        Personalizar
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        step={5}
                        value={credito}
                        onChange={(e) => setCredito(parseInt(e.target.value))}
                        className="w-full mt-2 accent-brand-400"
                      />
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>{credito}% — % do IBS/CBS abatido pelas compras</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCreditoModoAvancado(false);
                            setCredito(CREDITO_AUTO[regime] ?? 30);
                          }}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          Automático
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {(regime === "simples_nacional" || regime === "mei") && (
                  <div>
                    <label className={labelCls}>Faturamento anual (R$)</label>
                    <input
                      type="number"
                      min="1"
                      value={faturamento}
                      onChange={(e) => setFaturamento(e.target.value)}
                      className={inputCls}
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      Necessário para calcular a alíquota do Simples
                    </div>
                  </div>
                )}

                {mostrarFatorR && (
                  <div>
                    <label className={labelCls}>
                      Folha de pagamento mensal (R$){" "}
                      <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={folhaPagamento}
                      onChange={(e) => setFolhaPagamento(e.target.value)}
                      className={inputCls}
                      placeholder="Ex: 5000"
                    />
                    <div className="text-xs mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-700">
                      ⚖️ <strong>Fator R:</strong> define Anexo III ou V do Simples.
                      Sem folha, usamos Anexo V (conservador).
                    </div>
                  </div>
                )}
              </div>

              {meiIncompativel && (
                <div className="mt-4 rounded-xl bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-800">
                  <span className="font-bold">⛔ MEI vedado para esta atividade</span>
                  <p className="mt-1 text-xs leading-relaxed">
                    {setorSelecionado?.mei_conselho
                      ? `Profissão regulamentada pelo ${setorSelecionado.mei_conselho} — MEI é expressamente proibido.`
                      : setorSelecionado?.mei_restricao === "escala_industrial"
                      ? "Atividade de escala industrial incompatível com MEI."
                      : "Atividade não listada para MEI (CGSN 140/2018 + LC 128/2008, Art. 18-A, § 4º)."}
                    {" "}Considere Simples Nacional ou outro regime.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={carregando || setores.length === 0 || meiIncompativel}
                className="mt-6 w-full sm:w-auto rounded-xl bg-brand-400 px-8 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 active:bg-brand-600 disabled:opacity-40 transition-colors shadow-sm"
              >
                {carregando ? "Calculando…" : "Simular tributos →"}
              </button>
            </form>
          )}

          {/* ── MARKUP ──────────────────────────────────────────── */}
          {aba === "markup" && (
            <form
              onSubmit={calcularMarkup}
              className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm"
            >
              <h2 className="font-semibold text-brand-800 mb-1">
                Formação de preço de venda
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Descubra qual preço cobrar para manter sua margem com os novos
                impostos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Custo do produto/serviço (R$)</label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={custo}
                    onChange={(e) => setCusto(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Margem de lucro desejada (%)</label>
                  <input
                    type="number" min="1" max="99"
                    value={margem}
                    onChange={(e) => setMargem(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Despesas fixas (% do faturamento)</label>
                  <input
                    type="number" min="0" max="80"
                    value={despesas}
                    onChange={(e) => setDespesas(e.target.value)}
                    className={inputCls}
                  />
                  <div className="text-xs text-slate-400 mt-1">
                    Ex: aluguel, salários como % da receita
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    <TooltipGlossario termo="lucro_presumido">Regime tributário</TooltipGlossario>
                  </label>
                  <select
                    value={mRegime}
                    onChange={(e) => { setMRegime(e.target.value); setMCreditoAvancado(false); }}
                    className={inputCls}
                  >
                    {REGIMES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Setor de atividade</label>
                  <select
                    value={mSetorId}
                    onChange={(e) => setMSetorId(e.target.value)}
                    className={inputCls}
                  >
                    {setores.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>UF</label>
                  <select value={mUf} onChange={(e) => setMUf(e.target.value)} className={inputCls}>
                    {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    Ano de referência:{" "}
                    <strong className="text-brand-700">{mAno}</strong>
                  </label>
                  <input
                    type="range" min={2026} max={2033} value={mAno}
                    onChange={(e) => setMAno(parseInt(e.target.value))}
                    className="w-full mt-2 accent-brand-400"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>2026</span><span>2033</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    <TooltipGlossario termo="credito_entrada">Crédito de entradas</TooltipGlossario>
                  </label>
                  {!mCreditoAvancado ? (
                    <div className="rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-xs text-brand-700">
                      Estimado: <strong>{CREDITO_AUTO[mRegime] ?? 30}%</strong>
                      <button
                        type="button"
                        onClick={() => setMCreditoAvancado(true)}
                        className="ml-2 text-brand-500 hover:text-brand-700 underline"
                      >
                        Personalizar
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="range" min={0} max={80} step={5} value={mCredito}
                        onChange={(e) => setMCredito(parseInt(e.target.value))}
                        className="w-full mt-2 accent-brand-400"
                      />
                      <div className="text-xs text-slate-400 mt-1">{mCredito}%</div>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="submit"
                disabled={carregando || setores.length === 0}
                className="mt-6 w-full sm:w-auto rounded-xl bg-brand-400 px-8 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40 transition-colors shadow-sm"
              >
                {carregando ? "Calculando…" : "Calcular preço ideal →"}
              </button>
            </form>
          )}

          {/* ── COMPARADOR ──────────────────────────────────────── */}
          {aba === "comparador" && <ComparadorRegimes />}

          {/* Erro */}
          {erro && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          {/* Resultado simulação */}
          {resultado && <ResultadoSimulacao resultado={resultado} />}

          {/* Resultado markup */}
          {markupResult && (
            <div className="mt-6 rounded-2xl border border-brand-100 bg-white p-6 shadow-sm space-y-5">
              <h2 className="font-semibold text-brand-800">Resultado: quanto cobrar?</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500 mb-1">Hoje você deve cobrar</div>
                  <div className="text-2xl font-bold text-brand-800">
                    {brl(markupResult.preco_venda_sistema_atual)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Markup: {markupResult.markup_atual.toFixed(2)}× sobre o custo
                  </div>
                </div>
                <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                  <div className="text-xs text-brand-600 mb-1">
                    Com a reforma ({mAno}), cobrar
                  </div>
                  <div className="text-2xl font-bold text-brand-800">
                    {brl(markupResult.preco_venda_sistema_novo)}
                  </div>
                  <div className="text-xs text-brand-500 mt-1">
                    Markup: {markupResult.markup_novo.toFixed(2)}× sobre o custo
                  </div>
                </div>
              </div>

              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  markupResult.diferenca_preco > 0
                    ? "bg-amber-50 border border-amber-200 text-amber-800"
                    : "bg-green-50 border border-green-200 text-green-800"
                }`}
              >
                {markupResult.diferenca_preco > 0 ? (
                  <>
                    <strong>Atenção:</strong> com a reforma você precisará cobrar{" "}
                    <strong>{brl(Math.abs(markupResult.diferenca_preco))} a mais</strong> para
                    manter a margem. Carga tributária passa de{" "}
                    {markupResult.carga_tributaria_atual_percentual.toFixed(1)}% para{" "}
                    {markupResult.carga_tributaria_nova_percentual.toFixed(1)}%.
                  </>
                ) : (
                  <>
                    <strong>Boas notícias:</strong> você pode cobrar{" "}
                    <strong>{brl(Math.abs(markupResult.diferenca_preco))} a menos</strong> e
                    manter a mesma margem. Carga cai de{" "}
                    {markupResult.carga_tributaria_atual_percentual.toFixed(1)}% para{" "}
                    {markupResult.carga_tributaria_nova_percentual.toFixed(1)}%.
                  </>
                )}
              </div>

              <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-sm text-brand-800">
                <div className="font-semibold mb-1">
                  O que é o{" "}
                  <TooltipGlossario termo="split_payment">Split Payment</TooltipGlossario>?
                </div>
                <p className="text-xs leading-relaxed">
                  No novo sistema, quando um cliente te pagar{" "}
                  {brl(markupResult.preco_venda_sistema_novo)}, o banco separa
                  automaticamente{" "}
                  {brl(
                    markupResult.preco_venda_sistema_novo *
                      (markupResult.aliquota_efetiva_nova / 100)
                  )}{" "}
                  para o governo. Você recebe{" "}
                  {brl(
                    markupResult.preco_venda_sistema_novo *
                      (1 - markupResult.aliquota_efetiva_nova / 100)
                  )}{" "}
                  — planeje seu{" "}
                  <TooltipGlossario termo="capital_de_giro">capital de giro</TooltipGlossario>.
                </p>
              </div>

              <div className="text-xs text-slate-400 border-t pt-3">
                Fórmula: PV = Custo ÷ (1 − Margem% − DespesasFixas% − CargaTributária%).
                Cálculo "por fora" conforme LC 214/2025.
              </div>
            </div>
          )}

          {/* ── Base legal ──────────────────────────────────────── */}
          <div className="mt-8 rounded-2xl border border-brand-100 bg-white p-5 text-xs text-slate-500 space-y-1.5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ConflexIcon className="h-6 w-6" />
              <p className="font-semibold text-brand-800 text-sm">
                Base legal utilizada nos cálculos
              </p>
            </div>

            {/* Escopo dos tributos: incluídos vs não incluídos */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 mb-2">
              <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wide mb-2">
                O que esta simulação calcula
              </p>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                <div>
                  <p className="font-medium text-green-700 text-[10px] uppercase mb-1">
                    ✅ Tributos incluídos
                  </p>
                  {[
                    ["PIS / COFINS", "pis"],
                    ["ICMS (estadual)", "icms"],
                    ["ISS (municipal)", "iss"],
                    ["CBS — novo imposto federal", "cbs"],
                    ["IBS — novo imposto est./mun.", "ibs"],
                    ["IS — Imposto Seletivo (se aplicável)", "is"],
                  ].map(([label, termo]) => (
                    <p key={termo} className="text-slate-600">
                      ✅{" "}
                      <TooltipGlossario termo={termo}>{label}</TooltipGlossario>
                    </p>
                  ))}
                </div>
                <div>
                  <p className="font-medium text-red-600 text-[10px] uppercase mb-1">
                    ❌ Não incluídos (apurados separadamente)
                  </p>
                  {[
                    ["IRPJ — Imposto de Renda", "irpj"],
                    ["CSLL — Contrib. Social s/ Lucro", "csll"],
                    ["INSS Patronal / Folha de pagamento", null],
                    ["IOF — Imposto s/ Operações Financeiras", null],
                    ["Contribuições de terceiros (SESC, SENAI…)", null],
                  ].map(([label, termo], i) => (
                    <p key={i} className="text-slate-500">
                      ❌{" "}
                      {termo ? (
                        <TooltipGlossario termo={termo}>{label as string}</TooltipGlossario>
                      ) : (
                        label
                      )}
                    </p>
                  ))}
                  <p className="text-[10px] text-amber-700 mt-1.5 italic">
                    No Simples Nacional e MEI, IRPJ e CSLL já vêm no DAS.
                  </p>
                </div>
              </div>
            </div>

            <p>
              •{" "}
              <strong>
                <TooltipGlossario termo="cbs">LC 214/2025</TooltipGlossario>
              </strong>{" "}
              — CBS, IBS, Imposto Seletivo e cronograma de transição 2026–2033
            </p>
            <p>
              • <strong>EC 132/2023</strong> — Emenda constitucional que criou o{" "}
              <TooltipGlossario termo="iva_dual">IVA Dual</TooltipGlossario>
            </p>
            <p>
              • <strong>LC 123/2006</strong> —{" "}
              <TooltipGlossario termo="simples_nacional">Simples Nacional</TooltipGlossario>{" "}
              e MEI
            </p>
            <p>
              • <strong>LC 116/2003</strong> —{" "}
              <TooltipGlossario termo="iss">ISS</TooltipGlossario> (vigente até extinção gradual)
            </p>
            <p>
              • <strong>RICMS estaduais</strong> — Alíquotas internas de{" "}
              <TooltipGlossario termo="icms">ICMS</TooltipGlossario> por UF
            </p>
            <p className="pt-1 text-slate-400">
              As alíquotas de referência do IBS (~18,7%) e CBS (~9,3%) são estimativas oficiais
              sujeitas a resolução do Senado Federal. Este simulador é informativo e não constitui
              parecer jurídico ou contábil.
            </p>
            <p className="text-brand-400 font-medium pt-1">
              Conflex Contabilidade · conflex.com.br
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
