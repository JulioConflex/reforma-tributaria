"use client";

import { useEffect, useState } from "react";
import type { Setor, MarkupResult } from "./types";
import { REGIMES, UFS, API } from "./types";
import { FieldLabel, TextField, SelectField, NumberTicker, brl, CurrencyField, parseBRL } from "./ui";
import TooltipGlossario from "./TooltipGlossario";
import TransitionTimeline from "./Timeline";
import { AlertaOperadoraANS } from "./Simulador";

const CREDITO_AUTO: Record<string, number> = {
  simples_nacional: 0, mei: 0, lucro_presumido: 0, lucro_real: 0,
};

interface Props {
  setores: Setor[];
  ano: number;
  setAno: (n: number) => void;
  sharedSetorId: string;
  sharedUf: string;
  sharedRegime: string;
}

export default function MarkupTab({ setores, ano, setAno, sharedSetorId, sharedUf, sharedRegime }: Props) {
  const [custo, setCusto] = useState("");
  const [margem, setMargem] = useState("30");
  const [despesas, setDespesas] = useState("10");
  const [regime, setRegime] = useState(sharedRegime || "lucro_presumido");
  const [setorId, setSetorId] = useState(sharedSetorId || "comercio_geral");
  const [uf, setUf] = useState(sharedUf || "SP");
  const [creditoAvancado, setCreditoAvancado] = useState(false);
  const [credito, setCredito] = useState(0);
  const [pisCofinsRegime, setPisCofinsRegime] = useState<"cumulativo" | "nao_cumulativo">("nao_cumulativo");
  const [issManual, setIssManual] = useState("");
  const [faturamento, setFaturamento] = useState("360.000,00");
  const [folhaPagamento, setFolhaPagamento] = useState("");

  const [result, setResult] = useState<MarkupResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!creditoAvancado) setCredito(CREDITO_AUTO[regime] ?? 0);
  }, [regime, creditoAvancado]);

  useEffect(() => {
    setPisCofinsRegime(regime === "lucro_real" ? "nao_cumulativo" : "cumulativo");
  }, [regime]);

  // Debounced recalc
  useEffect(() => {
    if (setores.length === 0) return;
    const t = setTimeout(() => calcular(), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custo, margem, despesas, regime, setorId, uf, ano, credito, pisCofinsRegime, issManual, faturamento, folhaPagamento, setores.length]);

  const calcular = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`${API}/markup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custo: parseBRL(custo),
          margem_desejada: parseFloat(margem) / 100,
          despesas_fixas_percentual: parseFloat(despesas) / 100,
          regime,
          setor_id: setorId,
          uf,
          ano,
          percentual_credito_entrada: credito / 100,
          pis_cofins_regime: pisCofinsRegime,
          ...(showSimples && parseBRL(faturamento) > 0 ? { faturamento_anual: parseBRL(faturamento) } : {}),
          ...(mostrarFatorR && folhaPagamento ? { folha_pagamento_mensal: parseBRL(folhaPagamento) } : {}),
          ...(mostrarISS && issManual ? (() => {
            const v = parseFloat(issManual.replace(",", "."));
            return (!isNaN(v) && v >= 0 && v <= 5) ? { aliquota_iss: v / 100 } : {};
          })() : {}),
        }),
      });
      if (!res.ok) throw new Error("Erro no cálculo de markup");
      setResult(await res.json());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  };

  const setor = setores.find((s) => s.id === setorId);
  const showSimples = regime === "simples_nacional" || regime === "mei";
  const mostrarFatorR = regime === "simples_nacional" && setor?.anexo_simples === "FATOR_R";
  const mostrarISS = setor?.tipo === "servico" && regime !== "simples_nacional" && regime !== "mei";

  const margemNum = parseFloat(margem) || 0;
  const despesasNum = parseFloat(despesas) || 0;
  const somaMargemDespesas = margemNum + despesasNum;

  const aumento = (result?.diferenca_preco ?? 0) > 0;
  const aumentoPct = (result && result.preco_venda_sistema_atual > 0)
    ? (result.diferenca_preco / result.preco_venda_sistema_atual) * 100
    : 0;

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 mt-7 lg:items-start">
      {/* ── Form ── */}
      <aside className="rounded-2xl bg-white hairline-strong p-6 lg:p-7 lg:sticky lg:top-6 self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold">Markup</div>
          <h2 className="font-display text-[20px] font-bold text-ink-900 mt-0.5 leading-tight">Formação de preço</h2>
          <p className="text-[12.5px] text-ink-500 mt-1.5 leading-snug">
            Descubra o preço ideal para manter a margem com a nova carga.
          </p>
        </div>

        <div className="mb-4">
          <FieldLabel>Custo do produto / serviço</FieldLabel>
          <CurrencyField value={custo} onChange={setCusto} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-1">
          <div>
            <FieldLabel>Margem desejada</FieldLabel>
            <TextField type="number" suffix="%" value={margem} onChange={setMargem} />
          </div>
          <div>
            <FieldLabel>Outras despesas variáveis (sem contar impostos)</FieldLabel>
            <TextField type="number" suffix="%" value={despesas} onChange={setDespesas} />
          </div>
        </div>
        <p className="text-[11px] text-ink-400 mb-3 leading-snug">
          Despesas que incidem por venda: taxa da maquininha, comissão de vendedor, etc. Aluguel e salários <strong>não entram aqui</strong> — já estão cobertos pela margem acumulada das vendas.
        </p>
        {somaMargemDespesas >= 100 && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-[12px] text-red-700 leading-snug">
            <strong>Soma inválida:</strong> Margem ({margemNum}%) + Despesas ({despesasNum}%) = {somaMargemDespesas}%
            — já esgota 100% do preço sem incluir nenhum imposto. Reduza um dos valores.
          </div>
        )}
        {somaMargemDespesas > 0 && somaMargemDespesas < 100 && somaMargemDespesas >= 90 && (
          <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-[12px] text-amber-700 leading-snug">
            <strong>Atenção:</strong> Margem + Despesas = {somaMargemDespesas}% — sobram apenas {(100 - somaMargemDespesas).toFixed(1)}% para os impostos.
          </div>
        )}
        {somaMargemDespesas > 0 && somaMargemDespesas < 90 && <div className="mb-1" />}

        <div className="mb-4">
          <FieldLabel>
            <TooltipGlossario termo="lucro_presumido">Regime tributário</TooltipGlossario>
          </FieldLabel>
          <SelectField value={regime} onChange={setRegime}>
            {REGIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </SelectField>
        </div>

        {(regime === "lucro_presumido" || regime === "lucro_real") && (
          <div className="mb-4 rounded-lg border border-ink-100 bg-ink-50 px-3.5 py-2.5">
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink-500 font-semibold mb-2">PIS / COFINS</div>
            {regime === "lucro_presumido" ? (
              <div className="text-[12px] text-ink-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ink-400 inline-block" />
                Cumulativo <span className="font-normal text-ink-400 ml-1">(obrigatório — 0,65% + 3%)</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {(["nao_cumulativo", "cumulativo"] as const).map((opt) => (
                  <label key={opt} className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="pisCofinsMarkup" value={opt}
                      checked={pisCofinsRegime === opt} onChange={() => setPisCofinsRegime(opt)}
                      className="mt-0.5 accent-brand-600" />
                    <div>
                      <span className="text-[12.5px] font-medium text-ink-700">
                        {opt === "nao_cumulativo" ? "Não Cumulativo" : "Cumulativo"}
                      </span>
                      <span className="text-[11px] text-ink-400 block leading-snug">
                        {opt === "nao_cumulativo"
                          ? "1,65% + 7,6% com crédito (regra geral Lucro Real)"
                          : "0,65% + 3% sem crédito — entidades financeiras e equiparadas (Lei 9.718/98, Art. 14)"}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {showSimples && (
          <div className="mb-4 anim-in">
            <FieldLabel>Faturamento anual</FieldLabel>
            <CurrencyField value={faturamento} onChange={setFaturamento} />
            <p className="text-[11.5px] text-ink-400 mt-1.5 leading-snug">
              Define a faixa da alíquota efetiva do Simples — quanto maior o faturamento, maior a taxa.
            </p>
          </div>
        )}

        {mostrarFatorR && (
          <div className="mb-4 anim-in">
            <FieldLabel>
              Folha de pagamento mensal{" "}
              <span className="normal-case font-normal text-ink-400">(opcional)</span>
            </FieldLabel>
            <CurrencyField value={folhaPagamento} onChange={setFolhaPagamento} />
            <div className="mt-1.5 text-[11.5px] bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-700">
              ⚖️ <strong>Fator R:</strong> define Anexo III ou V do Simples. Sem folha, usa Anexo V (conservador).
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="col-span-2">
            <FieldLabel>Setor</FieldLabel>
            <SelectField value={setorId} onChange={setSetorId}>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </SelectField>
            {setorId === "operadoras_planos_saude_odontologicos" && <AlertaOperadoraANS />}
          </div>
          <div>
            <FieldLabel>UF</FieldLabel>
            <SelectField value={uf} onChange={setUf}>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </SelectField>
          </div>
        </div>

        {mostrarISS && (
          <div className="mb-4 anim-in">
            <FieldLabel>
              Alíquota de ISS municipal{" "}
              <span className="normal-case font-normal text-ink-400">(opcional, 2%–5%)</span>
            </FieldLabel>
            <div className="relative">
              <input
                type="number"
                min={2} max={5} step={0.5}
                value={issManual}
                onChange={(e) => setIssManual(e.target.value)}
                placeholder="Ex: 3"
                className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[14px] text-ink-900 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-400 pointer-events-none">%</span>
            </div>
            <p className="text-[11.5px] text-ink-400 mt-1.5 leading-snug">
              ISS varia por município (2% a 5%). Sem preenchimento, usa o padrão do setor.
            </p>
          </div>
        )}

        <div className="mb-4">
          <FieldLabel>
            <TooltipGlossario termo="credito_entrada">Crédito de entrada</TooltipGlossario>
          </FieldLabel>
          {!creditoAvancado ? (
            <div className="rounded-lg bg-brand-50 border border-brand-100 px-3.5 py-2.5 flex items-center justify-between">
              <div className="text-[13px] text-brand-700">
                <strong className="tab-num text-brand-800">{credito}%</strong> automático
              </div>
              <button onClick={() => setCreditoAvancado(true)} className="text-[12px] font-semibold text-brand-600 hover:text-brand-700">Personalizar</button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[13px] font-semibold text-ink-700 tab-num">{credito}%</div>
                <button onClick={() => { setCreditoAvancado(false); setCredito(CREDITO_AUTO[regime] ?? 0); }} className="text-[11px] font-medium text-ink-400 hover:text-ink-700">Voltar</button>
              </div>
              <input type="range" min={0} max={80} step={5} value={credito} onChange={(e) => setCredito(parseInt(e.target.value))} className="rng w-full" />
            </div>
          )}
        </div>

        <div className="mt-6 pt-5 border-t border-ink-100 flex items-center gap-2 text-[12px] text-ink-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400" />
          </span>
          {carregando ? "Calculando…" : "Recalculando em tempo real"}
        </div>
      </aside>

      {/* ── Result ── */}
      <section className="space-y-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1 lg:pb-6">
        {erro && <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{erro}</div>}

        {result?.aviso_impossivel && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-6">
            <div className="flex items-start gap-3">
              <svg className="shrink-0 mt-0.5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <div className="text-[14px] font-bold text-red-700 mb-1">Preço inviável — parâmetros incompatíveis</div>
                <p className="text-[13px] text-red-600 leading-snug">
                  Margem ({margem}%) + Despesas ({despesas}%) = <strong>{somaMargemDespesas.toFixed(1)}%</strong>,
                  e os impostos acrescentam mais <strong>{result.carga_tributaria_atual_percentual.toFixed(2)}%</strong>.
                  A soma ultrapassa 100% do preço de venda — matematicamente impossível.
                </p>
                <p className="text-[12.5px] text-red-500 mt-2">
                  Reduza a margem ou as despesas variáveis. Lembre: aluguel e salários <strong>não entram</strong> neste campo — use apenas taxas e comissões por venda.
                </p>
              </div>
            </div>
          </div>
        )}

        {result && !result.aviso_impossivel && (
          <>
            <TransitionTimeline ano={ano} setAno={setAno} />

            {result.valores_projetados && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 flex gap-3">
                <span className="text-amber-500 text-xl shrink-0 mt-0.5">⚠️</span>
                <div>
                  <p className="font-semibold text-amber-900 text-[13.5px] mb-1">
                    Preços baseados em projeções — sujeitos a alteração
                  </p>
                  <p className="text-[12.5px] text-amber-800 leading-relaxed">
                    As alíquotas de referência do IBS (~18,7%) e CBS (~9,3%) ainda não foram confirmadas pelo Senado Federal.
                    {showSimples && ano >= 2027 && (
                      <> Para o <strong>Simples Nacional</strong>, o modelo exato de integração do IBS/CBS ao DAS ainda não foi
                      regulamentado pelo Comitê Gestor do IBS — a estimativa usada pode ser significativamente diferente do resultado real.</>
                    )}
                    {" "}Os preços calculados poderão mudar quando os valores definitivos forem publicados.
                  </p>
                </div>
              </div>
            )}

            {/* Hero — três preços */}
            <div className="rounded-2xl bg-white hairline overflow-hidden">
              {/* Badge row */}
              <div className="px-6 lg:px-7 pt-5 pb-4 flex items-center gap-2 flex-wrap border-b border-ink-100">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold
                  ${Math.abs(aumentoPct) < 1 ? "bg-amber-50 text-amber-700 border-amber-100" :
                    aumento ? "bg-red-50 text-red-700 border-red-100" :
                              "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full
                    ${Math.abs(aumentoPct) < 1 ? "bg-amber-400" : aumento ? "bg-red-500" : "bg-emerald-500"}`}/>
                  {Math.abs(aumentoPct) < 1 ? "Preço quase igual" : aumento ? "Preço sobe" : "Preço cai"}
                </span>
                <span className="text-[11.5px] text-ink-400 font-medium">em {ano} · margem alvo {margem}%</span>
              </div>

              {/* Três colunas de preço */}
              <div className="grid grid-cols-1 lg:grid-cols-3">
                {/* 1. Sem impostos */}
                <div className="p-6 lg:p-7 border-b lg:border-b-0 lg:border-r border-ink-100">
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink-400 font-semibold mb-3">
                    Sem impostos
                  </div>
                  <div className="font-display text-[30px] leading-none font-bold text-ink-600 tab-num">
                    <NumberTicker value={result.preco_sem_tributo ?? 0} />
                  </div>
                  <div className="text-[12px] text-ink-400 mt-2">
                    Markup <strong className="tab-num text-ink-600">{(result.markup_sem_tributo ?? 0).toFixed(2)}×</strong>{" "}
                    sobre o custo
                  </div>
                  <p className="mt-3 text-[11px] text-ink-400 leading-snug">
                    Preço-base sem nenhum imposto — cobre custo, despesas e margem.
                  </p>
                </div>

                {/* 2. Sistema atual */}
                <div className="p-6 lg:p-7 border-b lg:border-b-0 lg:border-r border-ink-100">
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink-400 font-semibold mb-3">
                    Sistema atual
                  </div>
                  <div className="font-display text-[30px] leading-none font-bold text-ink-700 tab-num">
                    <NumberTicker value={result.preco_venda_sistema_atual} />
                  </div>
                  <div className="text-[12px] text-ink-400 mt-2">
                    Markup <strong className="tab-num text-ink-700">{result.markup_atual.toFixed(2)}×</strong>
                    {" · "}carga <span className="tab-num">{result.carga_tributaria_atual_percentual.toFixed(2)}%</span>
                  </div>
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1 font-medium">
                      +{brl((result.preco_venda_sistema_atual - (result.preco_sem_tributo ?? 0)))} em impostos
                    </span>
                  </div>
                </div>

                {/* 3. Com reforma */}
                <div className="p-6 lg:p-7 bg-brand-50/40">
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-brand-600 font-semibold mb-3">
                    Com reforma · {ano} — você deve cobrar
                  </div>
                  <div className="font-display text-[40px] leading-none font-bold text-brand-800 tab-num">
                    <NumberTicker value={result.preco_venda_sistema_novo} />
                  </div>
                  <div className="text-[12px] text-ink-500 mt-2">
                    Markup <strong className="tab-num text-ink-700">{result.markup_novo.toFixed(2)}×</strong>
                    {" · "}carga <span className="tab-num">{result.carga_tributaria_nova_percentual.toFixed(2)}%</span>
                  </div>
                  <div className="mt-3">
                    <span className={`inline-flex items-center gap-1 text-[11.5px] rounded-lg px-2.5 py-1 font-medium
                      ${Math.abs(aumentoPct) < 1
                        ? "text-amber-700 bg-amber-50"
                        : aumento ? "text-red-600 bg-red-50" : "text-emerald-700 bg-emerald-50"}`}>
                      {aumento ? "+" : Math.abs(aumentoPct) < 1 ? "" : "−"}{brl(Math.abs(result.diferenca_preco))} vs hoje
                    </span>
                  </div>
                </div>
              </div>

              {/* Carga tributária bars */}
              <div className="border-t border-ink-100/70 px-6 lg:px-7 py-5 mesh-bone">
                <div className="text-[11px] uppercase tracking-[0.08em] text-ink-500 font-semibold mb-3">
                  Carga tributária — atual vs com reforma
                </div>
                <div className="space-y-3">
                  <CargaBar label="Sistema atual" pct={result.carga_tributaria_atual_percentual} color="#5F6E84"
                    max={Math.max(result.carga_tributaria_atual_percentual, result.carga_tributaria_nova_percentual) + 5} />
                  <CargaBar label={`Em ${ano}`} pct={result.carga_tributaria_nova_percentual} color="#01D1FF"
                    max={Math.max(result.carga_tributaria_atual_percentual, result.carga_tributaria_nova_percentual) + 5} highlight />
                </div>
                <div className="mt-4 text-[11.5px] text-ink-500 leading-relaxed">
                  Cálculo &quot;por dentro&quot; — PV = Custo ÷ (1 − Margem − Despesas − Carga).
                </div>
              </div>
            </div>

            {/* Memória de cálculo */}
            <MemoriaMarkup result={result} />

            {/* Split Payment card */}
            <div className="rounded-2xl bg-brand-800 mesh-navy text-ink-100 px-7 py-7 overflow-hidden relative">
              <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.13] pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/conflex-c.png" alt="" className="h-[240px] w-auto block" />
              </div>
              <div className="relative grid lg:grid-cols-[1fr,auto] gap-6 items-center">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.10em] text-brand-300 font-semibold mb-1">Atenção · capital de giro</div>
                  <h3 className="font-display text-[20px] font-bold text-white mb-3 leading-tight">
                    <TooltipGlossario termo="split_payment">Split Payment</TooltipGlossario> retém o imposto na hora
                  </h3>
                  <p className="text-[14px] leading-relaxed max-w-xl text-ink-200">
                    Quando o cliente te pagar <strong className="text-white tab-num">{brl(result.preco_venda_sistema_novo)}</strong>,
                    o banco separa automaticamente{" "}
                    <strong className="text-brand-300 tab-num">{brl(result.preco_venda_sistema_novo * result.aliquota_efetiva_nova / 100)}</strong>{" "}
                    para o governo. Você recebe{" "}
                    <strong className="text-white tab-num">{brl(result.preco_venda_sistema_novo * (1 - result.aliquota_efetiva_nova / 100))}</strong>{" "}
                    — provisione seu <TooltipGlossario termo="capital_de_giro">capital de giro</TooltipGlossario>.
                  </p>
                </div>
                <div className="relative w-[160px] h-[160px] shrink-0 mx-auto">
                  <SplitDonut imposto={result.aliquota_efetiva_nova} />
                </div>
              </div>
            </div>

            {/* 3 ações práticas */}
            <div className="rounded-2xl bg-white hairline px-6 lg:px-7 py-6">
              <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold mb-0.5">Como ajustar agora</div>
              <h3 className="font-display text-[17px] font-bold text-ink-900 leading-tight mb-4">3 ações práticas</h3>
              <ol className="space-y-3">
                {[
                  { n: "01", titulo: "Reajuste a tabela de preços", desc: `Ajuste em ${aumento ? "+" : "−"}${Math.abs(aumentoPct).toFixed(1)}% para preservar a margem de ${margem}% até ${ano}.` },
                  { n: "02", titulo: "Negocie com fornecedores", desc: "Cada nota de compra vira crédito de IBS/CBS — mais entradas formais = menor imposto líquido." },
                  { n: "03", titulo: "Provisione o split payment", desc: `Reserve cerca de ${result.aliquota_efetiva_nova.toFixed(1)}% do faturamento para o pagamento automático ao governo.` },
                ].map((s) => (
                  <li key={s.n} className="flex gap-4 rounded-xl bg-ink-50/60 hairline p-4">
                    <div className="font-mono text-[11.5px] font-semibold text-brand-500 tab-num">{s.n}</div>
                    <div>
                      <div className="text-[13.5px] font-semibold text-ink-900">{s.titulo}</div>
                      <div className="text-[12.5px] text-ink-500 mt-1 leading-relaxed">{s.desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function MemoriaMarkup({ result }: { result: import("./types").MarkupResult }) {
  const [aberto, setAberto] = useState(false);
  const pv = result.preco_venda_sistema_novo;
  const carga = result.carga_tributaria_nova_percentual;
  const margem = result.margem_desejada;
  const despesas = result.despesas_fixas_percentual;
  const divisor = 100 - margem - despesas - carga;

  const totalTributos = result.detalhes_novo.reduce((s, d) => s + d.valor, 0);
  const valorDespesas = pv * (despesas / 100);
  const valorMargem = pv * (margem / 100);
  const soma = result.custo + totalTributos + valorDespesas + valorMargem;

  return (
    <div className="rounded-2xl bg-white hairline overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-6 lg:px-7 py-5 text-left hover:bg-ink-50/40 transition-colors"
        onClick={() => setAberto(!aberto)}
      >
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400 font-semibold mb-0.5">Transparência</div>
          <div className="font-display text-[16px] font-bold text-ink-900">Memória de cálculo do preço</div>
        </div>
        <span className={`text-ink-400 transition-transform ${aberto ? "rotate-180" : ""}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
        </span>
      </button>

      {aberto && (
        <div className="px-6 lg:px-7 pb-7 border-t border-ink-100">
          {/* Fórmula */}
          <div className="mt-5 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-[0.07em] text-brand-600 font-semibold mb-2">Fórmula aplicada</div>
            <div className="font-mono text-[13px] text-ink-800 leading-relaxed">
              PV = Custo ÷ (1 − Margem% − Despesas% − Carga%)
            </div>
            <div className="font-mono text-[13px] text-brand-700 font-semibold mt-1.5 leading-relaxed">
              PV = {brl(result.custo)} ÷ {(divisor / 100).toFixed(4)} = {brl(pv)}
            </div>
            <div className="text-[11.5px] text-ink-500 mt-2 leading-snug">
              Divisor = 1 − {margem.toFixed(1)}% (margem) − {despesas.toFixed(1)}% (despesas) − {carga.toFixed(2)}% (tributos) = {divisor.toFixed(2)}%
            </div>
          </div>

          {/* Decomposição do PV */}
          <div className="mt-5">
            <div className="text-[11px] uppercase tracking-[0.07em] text-ink-400 font-semibold mb-3">
              Decomposição do preço de venda ({brl(pv)})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-ink-100">
                    <th className="text-left text-[11px] text-ink-400 font-semibold pb-2 pr-4">Componente</th>
                    <th className="text-right text-[11px] text-ink-400 font-semibold pb-2 pr-4 tab-num">%&nbsp;s/ PV</th>
                    <th className="text-right text-[11px] text-ink-400 font-semibold pb-2 tab-num">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  <tr>
                    <td className="py-2 pr-4 font-medium text-ink-700">Custo</td>
                    <td className="py-2 pr-4 text-right tab-num text-ink-500">{((result.custo / pv) * 100).toFixed(2)}%</td>
                    <td className="py-2 text-right tab-num font-semibold text-ink-800">{brl(result.custo)}</td>
                  </tr>
                  {result.detalhes_novo.map((d) => (
                    <tr key={d.nome}>
                      <td className="py-2 pr-4 text-ink-600 text-[12.5px]">{d.nome}</td>
                      <td className="py-2 pr-4 text-right tab-num text-ink-400 text-[12px]">{d.aliquota_aplicada.toFixed(2)}%</td>
                      <td className="py-2 text-right tab-num text-ink-600">{brl(d.valor)}</td>
                    </tr>
                  ))}
                  <tr className="bg-ink-50/60">
                    <td className="py-2 pr-4 font-medium text-ink-700">Subtotal tributos</td>
                    <td className="py-2 pr-4 text-right tab-num text-ink-500">{carga.toFixed(2)}%</td>
                    <td className="py-2 text-right tab-num font-semibold text-amber-700">{brl(totalTributos)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-ink-600">Despesas fixas</td>
                    <td className="py-2 pr-4 text-right tab-num text-ink-400">{despesas.toFixed(1)}%</td>
                    <td className="py-2 text-right tab-num text-ink-600">{brl(valorDespesas)}</td>
                  </tr>
                  <tr className="bg-emerald-50/60">
                    <td className="py-2 pr-4 font-semibold text-emerald-700">Margem (lucro bruto)</td>
                    <td className="py-2 pr-4 text-right tab-num text-emerald-600">{margem.toFixed(1)}%</td>
                    <td className="py-2 text-right tab-num font-bold text-emerald-700">{brl(valorMargem)}</td>
                  </tr>
                  <tr className="border-t-2 border-ink-200">
                    <td className="pt-3 pr-4 font-bold text-ink-900">Total (PV)</td>
                    <td className="pt-3 pr-4 text-right tab-num font-bold text-ink-700">100%</td>
                    <td className="pt-3 text-right tab-num font-bold text-brand-700">{brl(soma)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[11.5px] text-ink-400 leading-snug">
              ✓ Custo ({brl(result.custo)}) + Tributos ({brl(totalTributos)}) + Despesas ({brl(valorDespesas)}) + Margem ({brl(valorMargem)}) = {brl(soma)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CargaBar({ label, pct, color, max, highlight }: { label: string; pct: number; color: string; max: number; highlight?: boolean }) {
  const w = max > 0 ? Math.min(100, (pct / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className={`text-[12.5px] ${highlight ? "font-semibold text-ink-900" : "text-ink-600"}`}>{label}</span>
        <span className={`tab-num ${highlight ? "font-bold text-brand-800 text-[15px]" : "text-ink-700 font-semibold text-[13px]"}`}>{pct.toFixed(2)}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-ink-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
      </div>
    </div>
  );
}

function SplitDonut({ imposto }: { imposto: number }) {
  const c = 70, r = 55, stroke = 18;
  const circ = 2 * Math.PI * r;
  const ofs = circ * (1 - imposto / 100);
  return (
    <svg viewBox="0 0 140 140" className="w-full h-full">
      <circle cx={c} cy={c} r={r} stroke="rgba(255,255,255,.10)" strokeWidth={stroke} fill="none" />
      <circle cx={c} cy={c} r={r} stroke="#01D1FF" strokeWidth={stroke} fill="none"
        strokeDasharray={circ} strokeDashoffset={ofs}
        transform={`rotate(-90 ${c} ${c})`} strokeLinecap="round" />
      <text x={c} y={c-4} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" className="tab-num">{imposto.toFixed(1)}%</text>
      <text x={c} y={c+14} textAnchor="middle" fill="#56DEFF" fontSize="9" fontWeight="600" letterSpacing="1.5">RETIDO</text>
    </svg>
  );
}
