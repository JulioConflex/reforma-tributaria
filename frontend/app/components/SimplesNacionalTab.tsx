"use client";

import { useEffect, useState } from "react";
import type { Setor } from "./types";
import { API } from "./types";
import { brl, FieldLabel, SelectField, CurrencyField, parseBRL } from "./ui";

// ─── Tipos do backend ────────────────────────────────────────────────────────

interface FatorRDetalhe {
  valor: number;
  threshold: number;
  anexo_atual: string;
  folha_minima_iii: number;
  muda_com_folha: boolean;
  aliq_efetiva_iii: number;
  aliq_efetiva_v: number;
  economia_mensal_iii: number;
}

interface SimplesOpcao {
  nome: string;
  custo_por_operacao: number;
  aliq_efetiva_pct: number;
  componentes: { nome: string; aliq_pct: number; valor: number }[];
  credito_comprador_b2b: number;
  custo_efetivo_comprador_b2b: number;
}

interface MarcoTimeline {
  ano: number;
  mes: string | null;
  evento: string;
  tipo: string;
  destaque: boolean;
}

interface SimplesAnaliseOutput {
  fator_r: FatorRDetalhe | null;
  eh_fator_r: boolean;
  das_aliquota_pct: number;
  das_mensal: number;
  anexo_nome: string;
  aviso_fator_r: string | null;
  normal: SimplesOpcao;
  hibrido: SimplesOpcao;
  diferenca_custo: number;
  break_even_b2b_pct: number | null;
  percentual_b2b_atual: number;
  recomendacao_tipo: string;
  recomendacao: string;
  marcos: MarcoTimeline[];
  setor_nome: string;
  ano: number;
  cbs_ref_pct: number;
  ibs_ref_pct: number;
}

// ─── Helpers visuais ─────────────────────────────────────────────────────────

function pct(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

function brlOp(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

const TIPO_COLOR: Record<string, string> = {
  decisao:     "bg-amber-100 text-amber-800 border-amber-200",
  obrigacao:   "bg-red-100 text-red-800 border-red-200",
  vigencia:    "bg-blue-100 text-blue-800 border-blue-200",
  oportunidade:"bg-emerald-100 text-emerald-800 border-emerald-200",
};

const TIPO_DOT: Record<string, string> = {
  decisao:     "bg-amber-500",
  obrigacao:   "bg-red-500",
  vigencia:    "bg-blue-500",
  oportunidade:"bg-emerald-500",
};

// ─── Componente principal ────────────────────────────────────────────────────

interface Props {
  setores: Setor[];
}

export default function SimplesNacionalTab({ setores }: Props) {
  const setoresSimples = setores.filter((s) => s.anexo_simples);

  const [setorId, setSetorId] = useState("comercio_geral");
  const [faturamento, setFaturamento] = useState("360.000,00");
  const [folha, setFolha] = useState("");
  const [b2bPct, setB2bPct] = useState(50);
  const [creditoPct, setCreditoPct] = useState(30);
  const [ano, setAno] = useState(2027);

  const [resultado, setResultado] = useState<SimplesAnaliseOutput | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const setor = setores.find((s) => s.id === setorId);
  const ehFatorR = setor?.anexo_simples === "FATOR_R";

  useEffect(() => {
    if (!setoresSimples.length) return;
    const ids = setoresSimples.map((s) => s.id);
    if (!ids.includes(setorId)) setSetorId(ids[0]);
  }, [setoresSimples.length]);

  useEffect(() => {
    const timer = setTimeout(() => calcular(), 300);
    return () => clearTimeout(timer);
  }, [setorId, faturamento, folha, b2bPct, creditoPct, ano]);

  async function calcular() {
    setCarregando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = {
        setor_id: setorId,
        faturamento_anual: parseBRL(faturamento) || 360000,
        percentual_b2b: b2bPct / 100,
        percentual_credito_entrada: creditoPct / 100,
        ano,
      };
      if (ehFatorR && folha) {
        body.folha_pagamento_mensal = parseBRL(folha);
      }
      const res = await fetch(`${API}/simples/analise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Erro na análise");
      }
      setResultado(await res.json());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  }

  const setorOpts = setoresSimples.map((s) => ({
    value: s.id,
    label: `${s.nome}${s.anexo_simples === "FATOR_R" ? " (Fator R)" : ` — Anexo ${s.anexo_simples}`}`,
  }));

  return (
    <div className="mt-7 grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      {/* ── Painel de inputs ─────────────────────────────────────────────── */}
      <aside className="rounded-2xl bg-white hairline px-6 py-6 space-y-5 lg:sticky lg:top-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.10em] text-ink-500 mb-1">
            Simples Nacional — LC 214/2025
          </div>
          <h2 className="font-display text-[20px] font-bold text-ink-900 leading-tight">
            Normal ou Híbrido?
          </h2>
          <p className="mt-1.5 text-[13px] text-ink-500 leading-relaxed">
            Compare as opções e descubra qual regime vale mais para o seu perfil de clientes.
          </p>
        </div>

        <div>
          <FieldLabel>Setor de atividade</FieldLabel>
          <SelectField value={setorId} onChange={setSetorId}>
            {setorOpts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </SelectField>
        </div>

        <div>
          <FieldLabel>Faturamento anual</FieldLabel>
          <CurrencyField value={faturamento} onChange={setFaturamento} placeholder="360.000,00" />
        </div>

        {ehFatorR && (
          <div>
            <FieldLabel>Folha de pagamento mensal</FieldLabel>
            <CurrencyField value={folha} onChange={setFolha} placeholder="ex: 8.400,00" />
            <p className="mt-1 text-[11.5px] text-ink-400">
              Usado para calcular o Fator R e definir Anexo III ou V.
            </p>
          </div>
        )}

        <div>
          <FieldLabel>Clientes B2B (%)</FieldLabel>
          <div className="flex items-center gap-3">
            <input
              type="range" min={0} max={100} step={5}
              value={b2bPct}
              onChange={(e) => setB2bPct(Number(e.target.value))}
              className="flex-1 accent-brand-500"
            />
            <span className="tab-num text-[15px] font-semibold text-ink-900 w-12 text-right">
              {b2bPct}%
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-ink-400">
            Empresas e profissionais que podem aproveitar crédito de CBS/IBS.
          </p>
        </div>

        <div>
          <FieldLabel>Crédito de entrada estimado (%)</FieldLabel>
          <div className="flex items-center gap-3">
            <input
              type="range" min={0} max={80} step={5}
              value={creditoPct}
              onChange={(e) => setCreditoPct(Number(e.target.value))}
              className="flex-1 accent-brand-500"
            />
            <span className="tab-num text-[15px] font-semibold text-ink-900 w-12 text-right">
              {creditoPct}%
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-ink-400">
            Percentual do CBS/IBS que você recupera nas compras.
          </p>
        </div>

        <div>
          <FieldLabel>Ano de referência</FieldLabel>
          <SelectField value={String(ano)} onChange={(v) => setAno(Number(v))}>
            {[2026,2027,2028,2029,2030,2031,2032,2033].map((y) => (
              <option key={y} value={y}>
                {y === 2026 ? "2026 (dispensado)" : y === 2033 ? "2033 (pleno)" : y}
              </option>
            ))}
          </SelectField>
        </div>

        <p className="text-[11px] text-ink-400 leading-relaxed border-t border-ink-100 pt-4">
          Base: LC 214/2025, Arts. 350-357 e Calculadora RTC Simples Nacional (Receita Federal).
        </p>
      </aside>

      {/* ── Painel de resultados ─────────────────────────────────────────── */}
      <section className="space-y-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1 lg:pb-6">
        {erro && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
            {erro}
          </div>
        )}

        {!resultado && !erro && (
          <div className="rounded-2xl bg-white hairline px-7 py-16 text-center text-ink-400">
            {carregando ? "Calculando…" : "Preencha os dados para ver a análise."}
          </div>
        )}

        {resultado && (
          <>
            {/* Fator R */}
            {resultado.eh_fator_r && resultado.fator_r && (
              <FatorRCard dados={resultado.fator_r} />
            )}

            {/* DAS atual */}
            <div className="rounded-2xl bg-white hairline px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.10em] text-ink-500 mb-1">
                    DAS atual — Anexo {resultado.anexo_nome}
                  </div>
                  <div className="tab-num text-[32px] font-bold text-ink-900 leading-none">
                    {pct(resultado.das_aliquota_pct)}
                  </div>
                  <div className="mt-1 text-[13px] text-ink-500">
                    {brl(resultado.das_mensal)} / mês sobre faturamento informado
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-ink-400">CBS ref.</div>
                  <div className="tab-num font-semibold text-ink-700">{pct(resultado.cbs_ref_pct)}</div>
                  <div className="mt-2 text-[11px] text-ink-400">IBS ref.</div>
                  <div className="tab-num font-semibold text-ink-700">{pct(resultado.ibs_ref_pct)}</div>
                </div>
              </div>
              {resultado.aviso_fator_r && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-[12.5px] text-amber-800">
                  {resultado.aviso_fator_r}
                </div>
              )}
            </div>

            {/* Comparativo Normal vs Híbrido */}
            <div className="grid sm:grid-cols-2 gap-4">
              <OpcaoCard opcao={resultado.normal} tipo="normal" ativa={resultado.recomendacao_tipo === "normal"} />
              <OpcaoCard opcao={resultado.hibrido} tipo="hibrido" ativa={resultado.recomendacao_tipo === "hibrido"} />
            </div>

            {/* Break-even */}
            {resultado.break_even_b2b_pct !== null && resultado.ano !== 2026 && (
              <BreakEvenCard
                breakEven={resultado.break_even_b2b_pct}
                b2bAtual={resultado.percentual_b2b_atual * 100}
                recomendacao={resultado.recomendacao_tipo}
              />
            )}

            {/* Recomendação */}
            <RecomendacaoCard
              tipo={resultado.recomendacao_tipo}
              texto={resultado.recomendacao}
            />

            {/* Linha do tempo */}
            <TimelineCard marcos={resultado.marcos} anoAtual={resultado.ano} />
          </>
        )}
      </section>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function FatorRCard({ dados }: { dados: FatorRDetalhe }) {
  const noAnexoIII = dados.anexo_atual === "III";
  return (
    <div className={`rounded-2xl border px-6 py-5 ${noAnexoIII ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
      <div className={`text-[11px] uppercase tracking-[0.10em] font-semibold mb-2 ${noAnexoIII ? "text-emerald-700" : "text-amber-700"}`}>
        Fator R — Definição do Anexo
      </div>
      <div className="flex items-end gap-6 flex-wrap">
        <div>
          <div className={`tab-num text-[36px] font-bold leading-none ${noAnexoIII ? "text-emerald-900" : "text-amber-900"}`}>
            {dados.valor.toFixed(1)}%
          </div>
          <div className={`text-[13px] mt-1 ${noAnexoIII ? "text-emerald-700" : "text-amber-700"}`}>
            Fator R atual (folha/faturamento 12m)
          </div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="text-[12px] font-medium text-ink-600 mb-1">
            Anexo atual: <strong>{dados.anexo_atual}</strong> ({dados.aliq_efetiva_iii.toFixed(2)}% III · {dados.aliq_efetiva_v.toFixed(2)}% V)
          </div>
          {!noAnexoIII && (
            <div className="text-[12px] text-amber-800">
              Para Anexo III: folha mensal de {brl(dados.folha_minima_iii)} ({dados.threshold}% de Fator R).
              {dados.economia_mensal_iii > 0 && (
                <span className="font-semibold"> Economia potencial: {brl(dados.economia_mensal_iii)}/mês.</span>
              )}
            </div>
          )}
          {noAnexoIII && (
            <div className="text-[12px] text-emerald-800 font-medium">
              Você está no Anexo III (menor alíquota para serviços). Folha adequada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OpcaoCard({ opcao, tipo, ativa }: {
  opcao: SimplesOpcao;
  tipo: "normal" | "hibrido";
  ativa: boolean;
}) {
  const isHibrido = tipo === "hibrido";
  return (
    <div className={`rounded-2xl border px-5 py-5 relative ${ativa ? "border-brand-400 shadow-[0_0_0_2px_rgba(1,209,255,.18)]" : "border-ink-200 bg-white"}`}>
      {ativa && (
        <div className="absolute -top-3 left-4 bg-brand-500 text-white text-[10.5px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
          Recomendado
        </div>
      )}
      <div className={`text-[10.5px] font-semibold uppercase tracking-[0.10em] mb-2 ${isHibrido ? "text-blue-600" : "text-ink-500"}`}>
        {isHibrido ? "Simples Híbrido (por fora)" : "DAS Normal"}
      </div>
      <div className="tab-num text-[30px] font-bold text-ink-900 leading-none">
        {brlOp(opcao.custo_por_operacao)}
      </div>
      <div className="text-[12px] text-ink-400 mt-0.5">por R$1.000 de venda</div>

      <div className="mt-4 space-y-2">
        {opcao.componentes.map((c, i) => (
          <div key={i} className="flex justify-between items-baseline text-[12px]">
            <span className="text-ink-500 leading-snug flex-1 mr-2">{c.nome}</span>
            <span className="tab-num font-semibold text-ink-800 whitespace-nowrap">{brlOp(c.valor)}</span>
          </div>
        ))}
      </div>

      <div className={`mt-4 rounded-lg px-3.5 py-2.5 ${isHibrido ? "bg-emerald-50 border border-emerald-200" : "bg-ink-50 border border-ink-200"}`}>
        <div className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${isHibrido ? "text-emerald-700" : "text-ink-500"}`}>
          Crédito do comprador B2B
        </div>
        <div className={`tab-num text-[18px] font-bold ${isHibrido ? "text-emerald-900" : "text-ink-500"}`}>
          {brlOp(opcao.credito_comprador_b2b)}
        </div>
        {isHibrido && opcao.credito_comprador_b2b > 0 && (
          <div className="text-[11px] text-emerald-700 mt-0.5">CBS + IBS integrais (Art. 156-A CF/88)</div>
        )}
        {!isHibrido && (
          <div className="text-[11px] text-ink-400 mt-0.5">Art. 28 LC 214/2025 — crédito praticamente nulo</div>
        )}
      </div>
    </div>
  );
}

function BreakEvenCard({ breakEven, b2bAtual, recomendacao }: {
  breakEven: number;
  b2bAtual: number;
  recomendacao: string;
}) {
  const acimaBreakEven = b2bAtual >= breakEven;
  const fillPct = Math.min(100, b2bAtual);
  const bePct   = Math.min(100, breakEven);

  return (
    <div className="rounded-2xl bg-white hairline px-6 py-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.10em] text-ink-500 mb-3">
        Break-even B2B
      </div>
      <div className="flex items-end gap-4 mb-4">
        <div>
          <div className="text-[13px] text-ink-500">Break-even</div>
          <div className="tab-num text-[28px] font-bold text-ink-900">{breakEven.toFixed(0)}%</div>
        </div>
        <div>
          <div className="text-[13px] text-ink-500">Seu perfil</div>
          <div className={`tab-num text-[28px] font-bold ${acimaBreakEven ? "text-emerald-700" : "text-amber-700"}`}>
            {b2bAtual.toFixed(0)}%
          </div>
        </div>
        <div className={`ml-auto px-3 py-1.5 rounded-full text-[12px] font-bold ${acimaBreakEven ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          {acimaBreakEven ? "Acima do break-even" : "Abaixo do break-even"}
        </div>
      </div>

      {/* Barra de gauge */}
      <div className="relative h-6 rounded-full bg-ink-100 overflow-visible">
        {/* faixa preenchida atual */}
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all ${acimaBreakEven ? "bg-emerald-400" : "bg-amber-400"}`}
          style={{ width: `${fillPct}%` }}
        />
        {/* marcador break-even */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-9 bg-ink-700 rounded-full z-10"
          style={{ left: `${bePct}%` }}
        />
        {/* label break-even */}
        <div
          className="absolute -top-6 -translate-x-1/2 text-[11px] font-semibold text-ink-600 whitespace-nowrap"
          style={{ left: `${bePct}%` }}
        >
          BE {breakEven.toFixed(0)}%
        </div>
      </div>

      <div className="mt-4 text-[12.5px] text-ink-500 leading-relaxed">
        {acimaBreakEven
          ? `Com ${b2bAtual.toFixed(0)}% de B2B, o crédito que seus clientes recuperam compensa o custo extra do Híbrido.`
          : `Com ${b2bAtual.toFixed(0)}% de B2B, o custo extra do Híbrido ainda supera o benefício competitivo do crédito. Aumente o B2B para ${breakEven.toFixed(0)}% para o Híbrido compensar.`
        }
      </div>
    </div>
  );
}

function RecomendacaoCard({ tipo, texto }: { tipo: string; texto: string }) {
  const configs: Record<string, { bg: string; border: string; titulo: string; labelColor: string }> = {
    hibrido:    { bg: "bg-brand-50",    border: "border-brand-300",   titulo: "Opte pelo Regime Híbrido",   labelColor: "text-brand-700" },
    normal:     { bg: "bg-white",       border: "border-ink-200",     titulo: "Mantenha o DAS Normal",      labelColor: "text-ink-500"   },
    dispensado: { bg: "bg-emerald-50",  border: "border-emerald-200", titulo: "Dispensado em 2026",         labelColor: "text-emerald-700"},
    indiferente:{ bg: "bg-blue-50",     border: "border-blue-200",    titulo: "Regimes equivalentes",       labelColor: "text-blue-700"  },
  };
  const cfg = configs[tipo] ?? configs.normal;

  return (
    <div className={`rounded-2xl border px-6 py-5 ${cfg.bg} ${cfg.border}`}>
      <div className={`text-[11px] uppercase tracking-[0.10em] font-semibold mb-1 ${cfg.labelColor}`}>
        Recomendação
      </div>
      <h3 className="font-display text-[17px] font-bold text-ink-900 leading-tight mb-2">
        {cfg.titulo}
      </h3>
      <p className="text-[13.5px] text-ink-700 leading-relaxed">
        {texto}
      </p>
      <div className="mt-3 rounded-lg bg-white/60 border border-white/80 px-3.5 py-2.5 text-[12px] text-ink-500">
        Esta análise é estimativa conservadora: o coeficiente de redução do DAS ainda não foi publicado pelo CGSN (Res. 190/2026, Art. 3). O Híbrido pode ficar ainda mais vantajoso após a regulamentação.
      </div>
    </div>
  );
}

function TimelineCard({ marcos, anoAtual }: { marcos: MarcoTimeline[]; anoAtual: number }) {
  return (
    <div className="rounded-2xl bg-white hairline px-6 py-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.10em] text-ink-500 mb-4">
        Linha do tempo — Decisões e obrigações
      </div>
      <div className="space-y-3">
        {marcos.map((m, i) => {
          const isAtual = m.ano === anoAtual;
          return (
            <div
              key={i}
              className={`flex gap-3 items-start rounded-xl px-3.5 py-3 transition ${isAtual ? "bg-brand-50 border border-brand-200" : ""}`}
            >
              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${TIPO_DOT[m.tipo] ?? "bg-ink-300"}`} />
              <div className="flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="tab-num text-[12.5px] font-bold text-ink-800">
                    {m.ano}{m.mes ? ` / ${m.mes}` : ""}
                  </span>
                  <span className={`inline-flex text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${TIPO_COLOR[m.tipo] ?? "bg-ink-100 text-ink-600 border-ink-200"}`}>
                    {m.tipo}
                  </span>
                </div>
                <p className={`text-[12.5px] leading-snug mt-0.5 ${m.destaque ? "text-ink-900 font-medium" : "text-ink-600"}`}>
                  {m.evento}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
