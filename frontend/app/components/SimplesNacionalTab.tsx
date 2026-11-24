"use client";

import { useState, useEffect } from "react";
import type { Setor } from "./types";
import { API } from "./types";
import { CurrencyField, parseBRL, brl } from "./ui";

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
  tipo: "decisao" | "obrigacao" | "vigencia" | "oportunidade";
  destaque: boolean;
}

interface SimplesAnalise {
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

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  setores: Setor[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pct = (n: number) => n.toFixed(2).replace(".", ",") + "%";

const MARCO_COR: Record<string, string> = {
  oportunidade: "bg-emerald-500",
  decisao:      "bg-amber-500",
  obrigacao:    "bg-red-500",
  vigencia:     "bg-brand-500",
};

const MARCO_BADGE: Record<string, string> = {
  oportunidade: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  decisao:      "bg-amber-50 text-amber-700 border border-amber-200",
  obrigacao:    "bg-red-50 text-red-700 border border-red-200",
  vigencia:     "bg-blue-50 text-blue-700 border border-blue-200",
};

const MARCO_LABEL: Record<string, string> = {
  oportunidade: "Oportunidade",
  decisao:      "Decisao",
  obrigacao:    "Obrigacao",
  vigencia:     "Vigencia",
};

const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

// ─── Componente principal ────────────────────────────────────────────────────

export default function SimplesNacionalTab({ setores }: Props) {
  const [setorId, setSetorId] = useState("comercio_geral");
  const [faturamento, setFaturamento] = useState("360.000,00");
  const [folhaMensal, setFolhaMensal] = useState("");
  const [b2bPct, setB2bPct] = useState(50);
  const [creditoEntrada, setCreditoEntrada] = useState(30);
  const [ano, setAno] = useState(2027);

  const [analise, setAnalise] = useState<SimplesAnalise | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const setor = setores.find((s) => s.id === setorId);
  const usaFatorR = setor?.anexo_simples === "FATOR_R";

  useEffect(() => {
    if (setores.length === 0) return;
    const t = setTimeout(() => calcular(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setorId, faturamento, folhaMensal, b2bPct, creditoEntrada, ano, setores.length]);

  const calcular = async () => {
    const fat = parseBRL(faturamento);
    if (fat <= 0) return;
    setCarregando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = {
        setor_id: setorId,
        faturamento_anual: fat,
        percentual_b2b: b2bPct / 100,
        percentual_credito_entrada: creditoEntrada / 100,
        ano,
      };
      if (usaFatorR && folhaMensal) {
        body.folha_pagamento_mensal = parseBRL(folhaMensal);
      }
      const res = await fetch(`${API}/simples/analise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Erro na analise");
      }
      setAnalise(await res.json());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="mt-7 space-y-6">
      {/* Cabecalho do modulo */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-900 to-brand-800 px-7 py-6 text-white">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-[22px] leading-tight">Modulo Simples Nacional</h2>
            <p className="mt-1 text-brand-200 text-[14px] max-w-2xl leading-relaxed">
              Calculadora de Fator R, comparativo Normal vs Hibrido (CBS/IBS por fora),
              linha do tempo de decisao e guia da reforma — tudo baseado na
              LC 214/2025 e no codigo oficial da Receita Federal.
            </p>
          </div>
        </div>
      </div>

      {/* Layout principal: config + resultados */}
      <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">

        {/* Painel de configuracao */}
        <aside className="rounded-2xl bg-white hairline-strong p-6 lg:sticky lg:top-6 space-y-5">
          <h3 className="font-semibold text-[14px] text-ink-700 uppercase tracking-wide">Parametros</h3>

          {/* Setor */}
          <div>
            <label className="block text-[12.5px] font-medium text-ink-500 mb-1.5">Setor de atividade</label>
            <select
              value={setorId}
              onChange={(e) => setSetorId(e.target.value)}
              className="w-full text-[13.5px] border border-ink-200 rounded-xl px-3 py-2.5 bg-white text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {setores
                .filter((s) => s.anexo_simples)
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
            </select>
            {setor?.anexo_simples && (
              <p className="mt-1.5 text-[11.5px] text-ink-400">
                Anexo {setor.anexo_simples === "FATOR_R" ? "III ou V (depende do Fator R)" : setor.anexo_simples}
              </p>
            )}
          </div>

          {/* Faturamento anual */}
          <div>
            <label className="block text-[12.5px] font-medium text-ink-500 mb-1.5">Faturamento anual (RBT12)</label>
            <CurrencyField value={faturamento} onChange={setFaturamento} placeholder="360.000,00" />
            <p className="mt-1.5 text-[11.5px] text-ink-400">Receita Bruta dos ultimos 12 meses</p>
          </div>

          {/* Folha mensal (so para Fator R) */}
          {usaFatorR && (
            <div>
              <label className="block text-[12.5px] font-medium text-ink-500 mb-1.5">
                Folha de pagamento mensal
                <span className="ml-1.5 text-[11px] text-amber-600 font-normal">(Fator R)</span>
              </label>
              <CurrencyField value={folhaMensal} onChange={setFolhaMensal} placeholder="8.000,00" />
              <p className="mt-1.5 text-[11.5px] text-ink-400">Pro-labore + CLT. Fator R = folha×12 / RBT12</p>
            </div>
          )}

          {/* % Clientes B2B */}
          <div>
            <label className="block text-[12.5px] font-medium text-ink-500 mb-1.5">
              Clientes B2B: <span className="text-ink-800 font-semibold">{b2bPct}%</span>
            </label>
            <input
              type="range" min={0} max={100} step={5}
              value={b2bPct}
              onChange={(e) => setB2bPct(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
            <div className="flex justify-between text-[11px] text-ink-400 mt-1">
              <span>0% — so B2C</span>
              <span>100% — so B2B</span>
            </div>
          </div>

          {/* Credito de entrada */}
          <div>
            <label className="block text-[12.5px] font-medium text-ink-500 mb-1.5">
              Credito de entrada: <span className="text-ink-800 font-semibold">{creditoEntrada}%</span>
            </label>
            <input
              type="range" min={0} max={80} step={5}
              value={creditoEntrada}
              onChange={(e) => setCreditoEntrada(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
            <p className="mt-1 text-[11.5px] text-ink-400">CBS/IBS sobre insumos que voce compra</p>
          </div>

          {/* Ano */}
          <div>
            <label className="block text-[12.5px] font-medium text-ink-500 mb-1.5">Ano de referencia</label>
            <div className="grid grid-cols-4 gap-1">
              {ANOS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAno(a)}
                  className={`text-[12px] font-medium py-1.5 rounded-lg transition ${
                    ano === a
                      ? "bg-brand-600 text-white"
                      : "bg-ink-50 text-ink-500 hover:bg-ink-100"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {carregando && (
            <div className="text-[12px] text-brand-500 font-medium animate-pulse text-center">Calculando…</div>
          )}
        </aside>

        {/* Resultados */}
        <div className="space-y-5">
          {erro && (
            <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{erro}</div>
          )}

          {analise ? (
            <>
              {/* DAS atual */}
              <CardDAS analise={analise} />

              {/* Fator R */}
              {analise.fator_r && <CardFatorR fr={analise.fator_r} aviso={analise.aviso_fator_r} />}

              {/* Comparativo Normal vs Hibrido */}
              {analise.ano >= 2027 ? (
                <CardComparativo analise={analise} b2bPct={b2bPct} />
              ) : (
                <CardDispensado ano={analise.ano} />
              )}

              {/* Recomendacao */}
              <CardRecomendacao analise={analise} />
            </>
          ) : !erro && (
            <div className="rounded-2xl bg-white hairline px-7 py-16 text-center text-ink-400 text-sm">
              Preencha os parametros para ver a analise.
            </div>
          )}
        </div>
      </div>

      {/* Linha do tempo */}
      {analise && <SecaoTimeline marcos={analise.marcos} anoAtual={analise.ano} />}

      {/* Guia de decisao */}
      <SecaoGuia />
    </div>
  );
}

// ─── DAS atual ───────────────────────────────────────────────────────────────

function CardDAS({ analise }: { analise: SimplesAnalise }) {
  return (
    <div className="rounded-2xl bg-white hairline px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[15px] text-ink-800">DAS — Documento de Arrecadacao do Simples</h3>
        <span className="text-[11.5px] font-medium text-ink-400 bg-ink-50 px-2.5 py-1 rounded-lg">
          Anexo {analise.anexo_nome}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-center">
          <div className="text-[11.5px] text-brand-600 font-medium mb-1">Aliquota efetiva</div>
          <div className="text-[24px] font-bold text-brand-700 leading-none">{pct(analise.das_aliquota_pct)}</div>
        </div>
        <div className="rounded-xl bg-ink-50 border border-ink-100 px-4 py-3 text-center">
          <div className="text-[11.5px] text-ink-500 font-medium mb-1">DAS mensal estimado</div>
          <div className="text-[18px] font-bold text-ink-800 leading-none">R$ {brl(analise.das_mensal)}</div>
        </div>
        <div className="rounded-xl bg-ink-50 border border-ink-100 px-4 py-3 text-center">
          <div className="text-[11.5px] text-ink-500 font-medium mb-1">CBS ref. / IBS ref.</div>
          <div className="text-[16px] font-bold text-ink-700 leading-none">
            {analise.cbs_ref_pct > 0 ? `${pct(analise.cbs_ref_pct)} / ${pct(analise.ibs_ref_pct)}` : "—"}
          </div>
        </div>
      </div>

      {analise.ano === 2026 && (
        <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-[12.5px] text-emerald-700">
          Em 2026 o Simples Nacional esta dispensado de CBS e IBS. Aproveite para planejar.
        </div>
      )}
    </div>
  );
}

// ─── Fator R ─────────────────────────────────────────────────────────────────

function CardFatorR({ fr, aviso }: { fr: FatorRDetalhe; aviso: string | null }) {
  const atingiu = fr.valor >= fr.threshold;
  const barWidth = Math.min(fr.valor / fr.threshold, 2) * 50; // escala visual

  return (
    <div className="rounded-2xl bg-white hairline px-6 py-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-semibold text-[15px] text-ink-800">Calculadora do Fator R</h3>
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
          atingiu ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}>
          Anexo {fr.anexo_atual} atual
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-[12px] text-ink-500 mb-1.5">
          <span>Fator R calculado</span>
          <span className="font-semibold text-ink-800">{pct(fr.valor)}</span>
        </div>
        <div className="relative h-3 rounded-full bg-ink-100 overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
              atingiu ? "bg-emerald-500" : "bg-amber-400"
            }`}
            style={{ width: `${Math.min(barWidth, 100)}%` }}
          />
          {/* Marcador de 28% */}
          <div className="absolute inset-y-0 left-1/2 w-0.5 bg-ink-400" />
        </div>
        <div className="flex justify-between text-[11px] text-ink-400 mt-1">
          <span>0%</span>
          <span className="font-medium text-ink-500">28% (limite Fator R)</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl px-4 py-3 ${atingiu ? "bg-emerald-50 border border-emerald-200" : "bg-ink-50 border border-ink-100"}`}>
          <div className="text-[11.5px] text-ink-500 mb-1">Aliquota se Anexo III</div>
          <div className="text-[16px] font-bold text-ink-800">{pct(fr.aliq_efetiva_iii)}</div>
          {atingiu && <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Aplicavel agora</div>}
        </div>
        <div className={`rounded-xl px-4 py-3 ${!atingiu ? "bg-amber-50 border border-amber-200" : "bg-ink-50 border border-ink-100"}`}>
          <div className="text-[11.5px] text-ink-500 mb-1">Aliquota se Anexo V</div>
          <div className="text-[16px] font-bold text-ink-800">{pct(fr.aliq_efetiva_v)}</div>
          {!atingiu && <div className="text-[11px] text-amber-600 font-medium mt-0.5">Aplicavel agora</div>}
        </div>
      </div>

      {!atingiu && fr.folha_minima_iii > 0 && (
        <div className="mt-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-[12.5px] text-blue-700">
          Para atingir o Fator R de 28% e usar o Anexo III, sua folha mensal precisaria ser de pelo menos{" "}
          <strong>R$ {brl(fr.folha_minima_iii)}</strong>.
          {fr.economia_mensal_iii > 0 && (
            <> Economia estimada: <strong>R$ {brl(fr.economia_mensal_iii)}/mes</strong>.</>
          )}
        </div>
      )}

      {aviso && (
        <div className="mt-3 text-[12px] text-ink-500 bg-ink-50 rounded-xl px-4 py-2.5">{aviso}</div>
      )}
    </div>
  );
}

// ─── Dispensado (2026) ───────────────────────────────────────────────────────

function CardDispensado({ ano }: { ano: number }) {
  return (
    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-6 py-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-[15px] text-emerald-800">Dispensado de CBS/IBS em {ano}</h3>
          <p className="mt-1.5 text-[13px] text-emerald-700 leading-relaxed max-w-lg">
            O Simples Nacional esta dispensado de recolher CBS e IBS em 2026. Nao ha diferenca
            entre o regime Normal e o Hibrido neste ano.
          </p>
          <p className="mt-2 text-[12.5px] text-emerald-600 font-medium">
            Use 2026 para planejar: calcule seu Fator R, mapeie clientes B2B e decida
            antes de junho/2027 se opta pelo regime Hibrido.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Comparativo Normal vs Hibrido ───────────────────────────────────────────

function CardComparativo({ analise, b2bPct }: { analise: SimplesAnalise; b2bPct: number }) {
  const { normal, hibrido, diferenca_custo, break_even_b2b_pct } = analise;
  const hibridoCaro = diferenca_custo > 0;

  return (
    <div className="rounded-2xl bg-white hairline px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[15px] text-ink-800">Normal vs Hibrido — sobre R$ 1.000 de venda</h3>
        <span className="text-[11px] text-ink-400">CBS ref.: {pct(analise.cbs_ref_pct)} · IBS ref.: {pct(analise.ibs_ref_pct)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Normal */}
        <div className="rounded-xl border-2 border-ink-200 px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-ink-400" />
            <span className="text-[12px] font-semibold text-ink-600 uppercase tracking-wide">Normal (DAS)</span>
          </div>
          <div className="text-[26px] font-bold text-ink-800 leading-none">R$ {brl(normal.custo_por_operacao)}</div>
          <div className="text-[11.5px] text-ink-400 mt-1">custo total</div>

          {normal.componentes.map((c, i) => (
            <div key={i} className="mt-2.5 pt-2.5 border-t border-ink-100">
              <div className="text-[11.5px] text-ink-500">{c.nome}</div>
              <div className="text-[13px] font-semibold text-ink-700 mt-0.5">R$ {brl(c.valor)}</div>
            </div>
          ))}

          <div className="mt-3 pt-3 border-t border-ink-100">
            <div className="text-[11.5px] text-ink-400">Credito para comprador B2B</div>
            <div className="text-[13px] font-semibold text-ink-500 mt-0.5">
              {normal.credito_comprador_b2b > 0 ? `R$ ${brl(normal.credito_comprador_b2b)}` : "Zero (Art. 28 LC 214/2025)"}
            </div>
          </div>
        </div>

        {/* Hibrido */}
        <div className={`rounded-xl border-2 px-4 py-4 ${
          !hibridoCaro ? "border-emerald-400 bg-emerald-50/40" : "border-indigo-200"
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[12px] font-semibold text-indigo-600 uppercase tracking-wide">Hibrido (por fora)</span>
          </div>
          <div className="text-[26px] font-bold text-ink-800 leading-none">R$ {brl(hibrido.custo_por_operacao)}</div>
          <div className="text-[11.5px] text-ink-400 mt-1">custo total</div>

          {hibrido.componentes.map((c, i) => (
            <div key={i} className="mt-2.5 pt-2.5 border-t border-ink-100">
              <div className="text-[11.5px] text-ink-500">{c.nome}</div>
              <div className="text-[13px] font-semibold text-ink-700 mt-0.5">R$ {brl(c.valor)}</div>
            </div>
          ))}

          {hibrido.credito_comprador_b2b > 0 && (
            <div className="mt-3 pt-3 border-t border-ink-100">
              <div className="text-[11.5px] text-ink-400">Credito para comprador B2B</div>
              <div className="text-[13px] font-semibold text-emerald-600 mt-0.5">
                R$ {brl(hibrido.credito_comprador_b2b)} (integral)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Diferenca e break-even */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl px-4 py-3 ${
          !hibridoCaro ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"
        }`}>
          <div className="text-[11.5px] text-ink-500 mb-1">Diferenca de custo (Hibrido - Normal)</div>
          <div className={`text-[18px] font-bold ${!hibridoCaro ? "text-emerald-700" : "text-amber-700"}`}>
            {diferenca_custo >= 0 ? "+" : ""}R$ {brl(Math.abs(diferenca_custo))}
          </div>
          <div className="text-[11px] text-ink-400 mt-0.5">
            {!hibridoCaro ? "Hibrido mais barato" : "Hibrido custa mais"}
          </div>
        </div>

        {break_even_b2b_pct !== null && (
          <div className={`rounded-xl px-4 py-3 ${
            b2bPct >= break_even_b2b_pct ? "bg-emerald-50 border border-emerald-200" : "bg-ink-50 border border-ink-100"
          }`}>
            <div className="text-[11.5px] text-ink-500 mb-1">Break-even B2B</div>
            <div className="text-[18px] font-bold text-ink-800">{pct(break_even_b2b_pct)}</div>
            <div className={`text-[11px] mt-0.5 font-medium ${
              b2bPct >= break_even_b2b_pct ? "text-emerald-600" : "text-ink-400"
            }`}>
              {b2bPct >= break_even_b2b_pct
                ? `Voce esta em ${b2bPct}% — Hibrido compensa`
                : `Voce esta em ${b2bPct}% — abaixo do ponto de virada`}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-ink-50 border border-ink-100 px-4 py-2.5 text-[12px] text-ink-500">
        Coeficiente de reducao do DAS no regime Hibrido ainda nao foi publicado pelo CGSN (Res. 190/2026, Art. 3). Calculo conservador: DAS integral + CBS/IBS por fora.
      </div>
    </div>
  );
}

// ─── Recomendacao ─────────────────────────────────────────────────────────────

function CardRecomendacao({ analise }: { analise: SimplesAnalise }) {
  const cores: Record<string, string> = {
    hibrido:    "bg-indigo-50 border-indigo-200 text-indigo-800",
    normal:     "bg-sky-50 border-sky-200 text-sky-800",
    dispensado: "bg-emerald-50 border-emerald-200 text-emerald-800",
    indiferente: "bg-ink-50 border-ink-200 text-ink-700",
  };
  const cls = cores[analise.recomendacao_tipo] || cores.indiferente;

  return (
    <div className={`rounded-2xl border px-6 py-5 ${cls}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {analise.recomendacao_tipo === "hibrido" && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
          )}
          {analise.recomendacao_tipo === "normal" && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/>
            </svg>
          )}
          {analise.recomendacao_tipo === "dispensado" && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/>
            </svg>
          )}
        </div>
        <div>
          <div className="font-semibold text-[14px] mb-1">
            {analise.recomendacao_tipo === "hibrido" && "Regime Hibrido parece vantajoso"}
            {analise.recomendacao_tipo === "normal" && "DAS Normal e mais vantajoso agora"}
            {analise.recomendacao_tipo === "dispensado" && "Sem CBS/IBS em " + analise.ano}
            {analise.recomendacao_tipo === "indiferente" && "Regimes equivalentes"}
          </div>
          <p className="text-[13px] leading-relaxed">{analise.recomendacao}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Linha do tempo ───────────────────────────────────────────────────────────

function SecaoTimeline({ marcos, anoAtual }: { marcos: MarcoTimeline[]; anoAtual: number }) {
  return (
    <div className="rounded-2xl bg-white hairline px-6 py-5">
      <h3 className="font-semibold text-[15px] text-ink-800 mb-5">
        Linha do tempo — Simples Nacional na Reforma Tributaria
      </h3>

      <div className="relative">
        {/* Linha horizontal */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-ink-100" />

        <div className="relative flex gap-4 overflow-x-auto pb-4">
          {marcos.map((m, i) => {
            const ativo = m.ano === anoAtual;
            const passado = m.ano < anoAtual;
            return (
              <div key={i} className="flex-shrink-0 w-52 pt-2">
                {/* Ponto na linha */}
                <div className="flex justify-center mb-3">
                  <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                    ativo ? "bg-brand-500 w-5 h-5" :
                    passado ? "bg-ink-300" :
                    MARCO_COR[m.tipo]
                  }`} />
                </div>

                {/* Card do marco */}
                <div className={`rounded-xl px-3.5 py-3 text-[12px] leading-snug border ${
                  ativo
                    ? "bg-brand-50 border-brand-200"
                    : passado
                    ? "bg-ink-50 border-ink-100 opacity-60"
                    : "bg-white border-ink-100"
                }`}>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className={`font-bold text-[14px] ${ativo ? "text-brand-700" : "text-ink-700"}`}>
                      {m.ano}
                    </span>
                    {m.mes && (
                      <span className="text-[10.5px] text-ink-400 font-medium">{m.mes}</span>
                    )}
                  </div>
                  <span className={`inline-block text-[10.5px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md mb-2 ${MARCO_BADGE[m.tipo]}`}>
                    {MARCO_LABEL[m.tipo]}
                  </span>
                  <p className="text-[12px] text-ink-600 leading-snug">{m.evento}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Guia de decisao ─────────────────────────────────────────────────────────

function SecaoGuia() {
  return (
    <div className="rounded-2xl bg-white hairline px-6 py-5">
      <h3 className="font-semibold text-[15px] text-ink-800 mb-1">Guia de decisao — qual regime escolher?</h3>
      <p className="text-[13px] text-ink-500 mb-5">
        Baseado na LC 214/2025 (Arts. 350-357) e no codigo oficial da Receita Federal (calculadora-rtc-simples-nacional).
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

        <GuiaCard
          titulo="Empresa B2C (consumidor final)"
          cor="emerald"
          icone="🛒"
          resumo="DAS Normal é o caminho"
          itens={[
            "Seus clientes sao consumidores finais — nao creditam CBS/IBS.",
            "O regime Hibrido nao gera beneficio competitivo para voce.",
            "Fique no DAS Normal: menor custo burocrático, sem mudanca.",
            "Em 2026 use o tempo para revisar precificacao e contratos.",
          ]}
        />

        <GuiaCard
          titulo="Empresa B2B mista (pessoa juridica)"
          cor="indigo"
          icone="🏭"
          resumo="Avalie o Hibrido com cuidado"
          itens={[
            "Seus clientes PJ podem creditar CBS/IBS — isso te torna mais competitivo.",
            "Use a calculadora acima: se o break-even for abaixo do seu % B2B, considere o Hibrido.",
            "Aguarde o coeficiente de reducao do DAS (CGSN) antes de decidir.",
            "Janela de opcao: 1o semestre de 2027 (irretratavel no semestre).",
          ]}
        />

        <GuiaCard
          titulo="Imposto Seletivo (IS)"
          cor="amber"
          icone="🚬"
          resumo="IS nao entra na base do Simples"
          itens={[
            "Tabaco, bebidas alcoolicas, veiculos, bebidas acucaradas: IS vigente desde 02/02/2027.",
            "O IS NAO compoe a receita bruta do Simples Nacional (RFB, NT 2026.005).",
            "O IS e um repasse ao consumidor — voce nao paga CBS/IBS sobre o IS.",
            "No regime Hibrido, o IS tambem nao entra na base de CBS/IBS.",
          ]}
        />

        <GuiaCard
          titulo="Split Payment (a partir de 2028)"
          cor="sky"
          icone="🏦"
          resumo="Regime Normal: impacto nulo"
          itens={[
            "No regime Normal, o DAS continua sendo pago diretamente. Split Payment nao muda isso.",
            "No regime Hibrido, o banco separa CBS/IBS antes de depositar (a partir de 2028).",
            "Fluxo de caixa: prepare-se para receber o valor liquido (sem CBS/IBS) mais rapido.",
            "2027 e voluntario para B2B; 2028 e obrigatorio para B2B; 2029 e pleno.",
          ]}
        />

        <GuiaCard
          titulo="Fator R — servicos intelectuais"
          cor="violet"
          icone="🧮"
          resumo="Folha vs faturamento define o Anexo"
          itens={[
            "Se voce e TI, engenharia, saude, contabilidade ou similar: use a calculadora do Fator R acima.",
            "Fator R = (folha dos ultimos 12m) / RBT12. Se >= 28%: Anexo III (aliquota menor).",
            "Pro-labore e CLT contam para o Fator R — vale revisar a politica de remuneracao.",
            "Na reforma, o CBS/IBS sera calculado sobre o mesmo Anexo do DAS.",
          ]}
        />

        <GuiaCard
          titulo="MEI — limites e restricoes"
          cor="rose"
          icone="👤"
          resumo="Fique atento ao novo limite"
          itens={[
            "Limite MEI em 2026: R$ 81.000/ano (R$ 6.750/mes).",
            "Se voce ultrapassar, e enquadrado automaticamente no Simples (Anexo I, II ou III).",
            "MEI que vende para PJ fica em desvantagem: o cliente nao credita CBS/IBS do MEI.",
            "Profissoes regulamentadas (medico, advogado, contador) nao podem ser MEI.",
          ]}
        />
      </div>
    </div>
  );
}

// ─── GuiaCard ────────────────────────────────────────────────────────────────

type Cor = "emerald" | "indigo" | "amber" | "sky" | "violet" | "rose";

const COR_HEADER: Record<Cor, string> = {
  emerald: "bg-emerald-50 border-emerald-200",
  indigo:  "bg-indigo-50 border-indigo-200",
  amber:   "bg-amber-50 border-amber-200",
  sky:     "bg-sky-50 border-sky-200",
  violet:  "bg-violet-50 border-violet-200",
  rose:    "bg-rose-50 border-rose-200",
};

const COR_TITULO: Record<Cor, string> = {
  emerald: "text-emerald-700",
  indigo:  "text-indigo-700",
  amber:   "text-amber-700",
  sky:     "text-sky-700",
  violet:  "text-violet-700",
  rose:    "text-rose-700",
};

function GuiaCard({
  titulo, cor, icone, resumo, itens,
}: {
  titulo: string; cor: Cor; icone: string; resumo: string; itens: string[];
}) {
  return (
    <div className="rounded-xl border border-ink-100 overflow-hidden">
      <div className={`px-4 py-3.5 border-b ${COR_HEADER[cor]}`}>
        <div className="flex items-center gap-2">
          <span className="text-[20px] leading-none">{icone}</span>
          <div>
            <div className={`font-semibold text-[13px] ${COR_TITULO[cor]}`}>{titulo}</div>
            <div className="text-[11.5px] text-ink-500 mt-0.5">{resumo}</div>
          </div>
        </div>
      </div>
      <ul className="px-4 py-3.5 space-y-2">
        {itens.map((item, i) => (
          <li key={i} className="flex gap-2 text-[12.5px] text-ink-600 leading-snug">
            <span className="shrink-0 mt-0.5 text-ink-300">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
