"use client";

import { useEffect, useState } from "react";
import type { Setor } from "./types";
import { API } from "./types";
import { brl, FieldLabel, SelectField, CurrencyField, parseBRL } from "./ui";

// ─── Tipos ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function brlOp(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}
function pct2(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

const TIPO_DOT: Record<string, string> = {
  decisao:      "bg-amber-500",
  obrigacao:    "bg-red-500",
  vigencia:     "bg-blue-500",
  oportunidade: "bg-emerald-500",
};
const TIPO_LABEL: Record<string, string> = {
  decisao:      "Decisão",
  obrigacao:    "Obrigação",
  vigencia:     "Vigência",
  oportunidade: "Oportunidade",
};

// ─── Crédito de entrada ───────────────────────────────────────────────────────

const CREDITO_OPCOES = [
  { valor: 10, label: "Poucos insumos",    sub: "Consultor, contador, designer" },
  { valor: 30, label: "Insumos moderados", sub: "Loja, comércio, serviço com equipamentos" },
  { valor: 50, label: "Muitos insumos",    sub: "Indústria, distribuidora, restaurante" },
  { valor: 20, label: "Não sei ainda",     sub: "Estimativa conservadora" },
];

function CreditoEntradaSelector({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  return (
    <div>
      <FieldLabel>Quanto você compra para funcionar?</FieldLabel>
      <p className="text-[11.5px] text-ink-500 mb-2 leading-relaxed">
        Na reforma você paga CBS/IBS nas compras e pode <strong className="text-ink-700">abater esse valor</strong> das vendas. Escolha o perfil mais próximo:
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {CREDITO_OPCOES.map((o) => {
          const ativo = o.valor === valor;
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => onChange(o.valor)}
              className={`text-left rounded-lg px-3 py-2.5 border text-[12px] transition-all ${
                ativo
                  ? "bg-brand-500 border-brand-500 text-white shadow-sm"
                  : "bg-white border-ink-200 hover:border-brand-400 hover:bg-brand-50"
              }`}
            >
              <div className={`font-semibold leading-tight ${ativo ? "text-white" : "text-ink-900"}`}>{o.label}</div>
              <div className={`text-[10.5px] mt-0.5 ${ativo ? "text-white/75" : "text-ink-500"}`}>{o.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function SimplesNacionalTab({ setores }: { setores: Setor[] }) {
  const setoresSimples = setores.filter((s) => s.anexo_simples);

  const [setorId, setSetorId]       = useState("comercio_geral");
  const [faturamento, setFaturamento] = useState("360.000,00");
  const [folha, setFolha]           = useState("");
  const [b2bPct, setB2bPct]         = useState(50);
  const [creditoPct, setCreditoPct] = useState(30);
  const [ano, setAno]               = useState(2027);

  const [resultado, setResultado]   = useState<SimplesAnaliseOutput | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro]             = useState<string | null>(null);
  const [memoriaAberta, setMemoriaAberta] = useState(false);

  const setor    = setores.find((s) => s.id === setorId);
  const ehFatorR = setor?.anexo_simples === "FATOR_R";

  useEffect(() => {
    if (!setoresSimples.length) return;
    const ids = setoresSimples.map((s) => s.id);
    if (!ids.includes(setorId)) setSetorId(ids[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setoresSimples.length]);

  useEffect(() => {
    const t = setTimeout(calcular, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (ehFatorR && folha) body.folha_pagamento_mensal = parseBRL(folha);
      const res = await fetch(`${API}/simples/analise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Erro"); }
      setResultado(await res.json());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  }

  const setorOpts = setoresSimples.map((s) => ({
    value: s.id,
    label: s.nome + (s.anexo_simples === "FATOR_R" ? " (Fator R)" : ` — Anexo ${s.anexo_simples}`),
  }));

  return (
    <div className="mt-7 grid lg:grid-cols-[360px_1fr] gap-6 items-start">

      {/* ── Painel de inputs ───────────────────────────────────────────── */}
      <aside className="rounded-2xl bg-white hairline px-6 py-6 space-y-5 lg:sticky lg:top-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.10em] text-ink-500 mb-1">
            Simples Nacional — LC 214/2025
          </div>
          <h2 className="font-display text-[20px] font-bold text-ink-900 leading-tight">
            Normal ou Híbrido?
          </h2>
        </div>

        <div>
          <FieldLabel>Setor de atividade</FieldLabel>
          <SelectField value={setorId} onChange={setSetorId}>
            {setorOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectField>
        </div>

        <div>
          <FieldLabel>Faturamento anual (RBT12)</FieldLabel>
          <CurrencyField value={faturamento} onChange={setFaturamento} placeholder="360.000,00" />
        </div>

        {ehFatorR && (
          <div>
            <FieldLabel>Folha de pagamento mensal <span className="text-brand-500 font-bold">(Fator R)</span></FieldLabel>
            <CurrencyField value={folha} onChange={setFolha} placeholder="ex: 8.400,00" />
            <p className="mt-1 text-[11px] text-ink-400">Pro-labore + CLT. Fator R = folha×12 / RBT12</p>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <FieldLabel className="mb-0">
              Quantos dos seus clientes são empresas? <span className="tab-num text-ink-900 font-bold">{b2bPct}%</span>
            </FieldLabel>
          </div>
          <input
            type="range" min={0} max={100} step={5}
            value={b2bPct}
            onChange={(e) => setB2bPct(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
          <div className="flex justify-between text-[10.5px] text-ink-400 mt-0.5">
            <span>0% — só pessoas físicas</span><span>100% — só empresas</span>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-400">
            Empresas e profissionais (médico, advogado, engenheiro etc.) que emitem nota para a própria empresa conseguem recuperar o imposto pago nas compras. Pessoas físicas, não.
          </p>
        </div>

        <CreditoEntradaSelector valor={creditoPct} onChange={setCreditoPct} />

        <div>
          <FieldLabel>Ano de referência</FieldLabel>
          <SelectField value={String(ano)} onChange={(v) => setAno(Number(v))}>
            {[2026,2027,2028,2029,2030,2031,2032,2033].map((y) => (
              <option key={y} value={y}>
                {y === 2026 ? "2026 — dispensado de CBS/IBS" : y === 2033 ? "2033 — sistema pleno" : String(y)}
              </option>
            ))}
          </SelectField>
        </div>

        <p className="text-[11px] text-ink-400 border-t border-ink-100 pt-3 leading-relaxed">
          Base: LC 214/2025 Arts. 350-357 · Calculadora RTC Simples Nacional (Receita Federal)
        </p>
      </aside>

      {/* ── Resultados ─────────────────────────────────────────────────── */}
      <section className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1 lg:pb-6">
        {erro && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{erro}</div>
        )}

        {!resultado && !erro && (
          <div className="rounded-2xl bg-white hairline px-7 py-16 text-center text-ink-400">
            {carregando ? "Calculando…" : "Preencha os dados para ver a análise."}
          </div>
        )}

        {resultado && (
          <>
            {/* 1. Recomendação — topo, destaque */}
            <RecomendacaoCard tipo={resultado.recomendacao_tipo} texto={resultado.recomendacao} />

            {/* 2. Comparativo simplificado */}
            <ComparativoCard r={resultado} />

            {/* 3. Fator R — só se aplicável */}
            {resultado.eh_fator_r && resultado.fator_r && (
              <FatorRCard dados={resultado.fator_r} />
            )}

            {/* 4. Memória de cálculo — accordion */}
            <div className="rounded-2xl bg-white hairline overflow-hidden">
              <button
                type="button"
                onClick={() => setMemoriaAberta((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-ink-50 transition"
              >
                <div>
                  <span className="text-[13.5px] font-semibold text-ink-800">Como calculamos</span>
                  <span className="ml-2 text-[12px] text-ink-400">passo a passo dos valores acima</span>
                </div>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`flex-shrink-0 text-ink-400 transition-transform ${memoriaAberta ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {memoriaAberta && <MemoriaCalculo r={resultado} creditoPct={creditoPct} />}
            </div>

            {/* 5. Linha do tempo — compacta */}
            <TimelineCard marcos={resultado.marcos} anoAtual={resultado.ano} />
          </>
        )}
      </section>
    </div>
  );
}

// ─── Recomendação ────────────────────────────────────────────────────────────

function RecomendacaoCard({ tipo, texto }: { tipo: string; texto: string }) {
  const cfg: Record<string, { icon: string; titulo: string; bg: string; border: string; iconBg: string }> = {
    hibrido:    { icon: "✓", titulo: "Opte pelo Regime Híbrido",  bg: "bg-emerald-50", border: "border-emerald-300", iconBg: "bg-emerald-500" },
    normal:     { icon: "✓", titulo: "Mantenha o DAS Normal",    bg: "bg-white",      border: "border-ink-200",     iconBg: "bg-brand-500"   },
    dispensado: { icon: "i", titulo: "Dispensado em 2026",       bg: "bg-blue-50",    border: "border-blue-200",    iconBg: "bg-blue-500"    },
    indiferente:{ icon: "=", titulo: "Regimes equivalentes",     bg: "bg-ink-50",     border: "border-ink-200",     iconBg: "bg-ink-400"     },
  };
  const c = cfg[tipo] ?? cfg.normal;
  return (
    <div className={`rounded-2xl border px-6 py-5 ${c.bg} ${c.border}`}>
      <div className="flex items-start gap-4">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[15px] flex-shrink-0 mt-0.5 ${c.iconBg}`}>
          {c.icon}
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.10em] text-ink-500 mb-0.5">Recomendação</div>
          <h3 className="font-display text-[18px] font-bold text-ink-900 leading-tight mb-2">{c.titulo}</h3>
          <p className="text-[13px] text-ink-700 leading-relaxed">{texto}</p>
        </div>
      </div>
      <div className="mt-3 ml-13 text-[11.5px] text-ink-500 bg-white/60 border border-white rounded-lg px-3.5 py-2.5 leading-relaxed">
        Estimativa conservadora: o coeficiente de redução do DAS no Híbrido ainda não foi publicado pelo CGSN (Res. 190/2026). O Híbrido tende a ser ainda mais vantajoso após a regulamentação.
      </div>
    </div>
  );
}

// ─── Comparativo Normal vs Híbrido ───────────────────────────────────────────

function ComparativoCard({ r }: { r: SimplesAnaliseOutput }) {
  const dispensado = r.ano === 2026;
  const recHibrido = r.recomendacao_tipo === "hibrido";
  return (
    <div className="rounded-2xl bg-white hairline px-6 py-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.10em] text-ink-500 mb-4">
        Comparativo — base R$1.000 de venda · Anexo {r.anexo_nome} · {pct2(r.das_aliquota_pct)} DAS
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Normal */}
        <div className={`rounded-xl border px-4 py-4 ${!recHibrido && !dispensado ? "border-brand-400 bg-brand-50" : "border-ink-200"}`}>
          <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-2">DAS Normal</div>
          <div className="tab-num text-[26px] font-bold text-ink-900 leading-none">{brlOp(r.normal.custo_por_operacao)}</div>
          <div className="text-[11px] text-ink-400 mt-0.5">custo por R$1.000</div>
          <div className="mt-3 pt-3 border-t border-ink-100">
            <div className="text-[11px] text-ink-500 mb-0.5">Crédito para o comprador B2B</div>
            <div className="tab-num text-[15px] font-bold text-ink-400">{brlOp(r.normal.credito_comprador_b2b)}</div>
            <div className="text-[10.5px] text-ink-400">praticamente nulo (Art. 28 LC 214)</div>
          </div>
        </div>

        {/* Híbrido */}
        <div className={`rounded-xl border px-4 py-4 ${recHibrido && !dispensado ? "border-brand-400 bg-brand-50" : "border-ink-200"}`}>
          <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-2">Simples Híbrido</div>
          <div className="tab-num text-[26px] font-bold text-ink-900 leading-none">{brlOp(r.hibrido.custo_por_operacao)}</div>
          <div className="text-[11px] text-ink-400 mt-0.5">custo por R$1.000</div>
          <div className="mt-3 pt-3 border-t border-ink-100">
            <div className="text-[11px] text-ink-500 mb-0.5">Crédito para o comprador B2B</div>
            <div className={`tab-num text-[15px] font-bold ${r.hibrido.credito_comprador_b2b > 0 ? "text-emerald-700" : "text-ink-400"}`}>
              {brlOp(r.hibrido.credito_comprador_b2b)}
            </div>
            {r.hibrido.credito_comprador_b2b > 0 && (
              <div className="text-[10.5px] text-emerald-700">CBS + IBS integrais (Art. 156-A CF)</div>
            )}
          </div>
        </div>
      </div>

      {/* Vale a pena mudar? */}
      {r.break_even_b2b_pct !== null && !dispensado && (
        <ValePenaCard r={r} />
      )}
    </div>
  );
}

// ─── Vale a pena mudar? (break-even em linguagem simples) ────────────────────

function ValePenaCard({ r }: { r: SimplesAnaliseOutput }) {
  const extra     = r.hibrido.custo_por_operacao - r.normal.custo_por_operacao;
  const credito   = r.hibrido.credito_comprador_b2b;
  const b2bAtual  = r.percentual_b2b_atual;
  const minEmp    = r.break_even_b2b_pct!;
  const compensa  = b2bAtual >= minEmp;

  return (
    <div className={`rounded-xl border px-4 py-4 mt-4 ${compensa ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
      <div className={`text-[12px] font-bold mb-3 ${compensa ? "text-emerald-800" : "text-amber-800"}`}>
        Vale a pena mudar para o Híbrido?
      </div>

      {/* Linha 1: o que você paga a mais */}
      <div className="flex gap-2 mb-2">
        <div className="mt-0.5 w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <span className="text-red-600 text-[10px] font-bold">+</span>
        </div>
        <p className="text-[12.5px] text-ink-700 leading-snug">
          No Híbrido você paga <strong className="text-ink-900">{brlOp(extra)} a mais</strong> por R$1.000 de venda (CBS e IBS cobrados separadamente).
        </p>
      </div>

      {/* Linha 2: o que o cliente empresa ganha */}
      <div className="flex gap-2 mb-3">
        <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <span className="text-emerald-600 text-[10px] font-bold">✓</span>
        </div>
        <p className="text-[12.5px] text-ink-700 leading-snug">
          Em troca, cada cliente empresa recupera <strong className="text-ink-900">{brlOp(credito)}</strong> de imposto por R$1.000 que comprar de você — e pode preferir comprar de quem oferece isso.
        </p>
      </div>

      {/* Conclusão */}
      <div className={`rounded-lg px-3.5 py-3 text-[12.5px] font-medium leading-snug ${compensa ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
        {compensa
          ? <>Com <strong>{b2bAtual.toFixed(0)}%</strong> de clientes empresa, o benefício que você oferece compensa o custo extra. <strong>O Híbrido vale a pena.</strong></>
          : <>Com <strong>{b2bAtual.toFixed(0)}%</strong> de clientes empresa, o custo extra ainda supera o benefício. O Híbrido valeria se você tivesse pelo menos <strong>{minEmp.toFixed(0)}%</strong> de clientes empresa.</>
        }
      </div>

      {/* Barra visual simples */}
      <div className="mt-3">
        <div className="flex justify-between text-[10.5px] text-ink-500 mb-1">
          <span>Seus clientes empresa: <strong className="text-ink-800">{b2bAtual.toFixed(0)}%</strong></span>
          <span>Mínimo para compensar: <strong className="text-ink-800">{minEmp.toFixed(0)}%</strong></span>
        </div>
        <div className="relative h-2.5 rounded-full bg-ink-200">
          <div
            className={`absolute left-0 top-0 h-full rounded-full ${compensa ? "bg-emerald-400" : "bg-amber-400"}`}
            style={{ width: `${Math.min(100, b2bAtual)}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-ink-600 rounded-full"
            style={{ left: `${Math.min(99, minEmp)}%` }}
          />
        </div>
        <div className="text-[10px] text-ink-400 mt-1 text-right">
          A linha vertical marca o mínimo necessário
        </div>
      </div>
    </div>
  );
}

// ─── Fator R ─────────────────────────────────────────────────────────────────

function FatorRCard({ dados }: { dados: FatorRDetalhe }) {
  const noIII = dados.anexo_atual === "III";
  return (
    <div className={`rounded-2xl border px-6 py-4 ${noIII ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
      <div className={`text-[11px] uppercase tracking-[0.10em] font-semibold mb-3 ${noIII ? "text-emerald-700" : "text-amber-700"}`}>
        Fator R — define o Anexo do seu setor
      </div>
      <p className="text-[12px] text-ink-600 mb-3 leading-relaxed">
        Para serviços com Fator R, o Anexo (e a alíquota DAS) depende da proporção entre folha de pagamento e faturamento.
        Fator R = folha 12 meses ÷ faturamento 12 meses.
      </p>
      <div className="flex items-center gap-6 flex-wrap">
        <div>
          <div className={`tab-num text-[32px] font-bold leading-none ${noIII ? "text-emerald-900" : "text-amber-900"}`}>{dados.valor.toFixed(1)}%</div>
          <div className="text-[12px] text-ink-600 mt-0.5">Fator R calculado</div>
        </div>
        <div className="flex-1 min-w-[180px] space-y-1">
          <div className="text-[12.5px]">
            Anexo atual: <strong className="text-ink-900">{dados.anexo_atual}</strong> —
            alíquota <span className="tab-num font-semibold">{noIII ? pct2(dados.aliq_efetiva_iii) : pct2(dados.aliq_efetiva_v)}</span>
          </div>
          {!noIII && (
            <div className={`text-[12px] rounded-lg px-3 py-2 bg-amber-100 text-amber-900`}>
              Para cair no Anexo III ({pct2(dados.aliq_efetiva_iii)}), a folha mensal precisa ser {brl(dados.folha_minima_iii)}.
              {dados.economia_mensal_iii > 0 && <span className="font-semibold"> Economia potencial: {brl(dados.economia_mensal_iii)}/mês.</span>}
            </div>
          )}
          {noIII && (
            <div className="text-[12px] text-emerald-800 font-medium">
              Folha adequada. Você está no Anexo com menor alíquota para serviços.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Memória de cálculo ───────────────────────────────────────────────────────

function MemoriaCalculo({ r, creditoPct }: { r: SimplesAnaliseOutput; creditoPct: number }) {
  const BASE = 1000;
  const dispensado = r.ano === 2026;

  const passos: { titulo: string; linhas: { label: string; valor: string; destaque?: boolean }[]; nota?: string }[] = [];

  // Passo 1: DAS
  passos.push({
    titulo: "1. Alíquota DAS (sua situação atual)",
    linhas: [
      { label: "Faturamento anual informado (RBT12)", valor: brl(parseBRL("") || 360000) },
      { label: `Tabela Simples — Anexo ${r.anexo_nome}`, valor: "" },
      { label: "Alíquota DAS efetiva", valor: pct2(r.das_aliquota_pct), destaque: true },
      { label: "DAS mensal estimado", valor: brl(r.das_mensal) },
    ],
    nota: r.aviso_fator_r ?? undefined,
  });

  if (!dispensado) {
    // Passo 2: Alíquotas de referência
    passos.push({
      titulo: "2. CBS e IBS de referência neste ano",
      linhas: [
        { label: `CBS (Contribuição sobre Bens e Serviços) — ${r.ano}`, valor: pct2(r.cbs_ref_pct) },
        { label: `IBS (Imposto sobre Bens e Serviços) — ${r.ano}`, valor: pct2(r.ibs_ref_pct) },
        { label: "Total CBS + IBS", valor: pct2(r.cbs_ref_pct + r.ibs_ref_pct), destaque: true },
      ],
      nota: "Alíquotas de referência da LC 214/2025. No regime Híbrido, CBS e IBS são cobrados por fora do DAS a essas alíquotas.",
    });

    // Passo 3: Regime Normal
    passos.push({
      titulo: "3. Regime Normal — sobre R$1.000 de venda",
      linhas: [
        { label: `DAS: R$ 1.000 × ${pct2(r.das_aliquota_pct)}`, valor: brlOp(r.normal.custo_por_operacao) },
        { label: "CBS/IBS embutidos no DAS (alíquota reduzida)", valor: "incluso" },
        { label: "Custo total para você", valor: brlOp(r.normal.custo_por_operacao), destaque: true },
        { label: "Crédito disponível para o comprador B2B", valor: brlOp(r.normal.credito_comprador_b2b) },
      ],
      nota: "No DAS Normal, CBS e IBS ficam embutidos com alíquota muito reduzida. O comprador B2B não consegue tomar crédito (Art. 28 LC 214/2025).",
    });

    // Passo 4: Regime Híbrido
    const linhasHibrido = r.hibrido.componentes.map((c) => ({
      label: c.nome,
      valor: brlOp(c.valor),
    }));
    linhasHibrido.push({ label: "Custo total para você", valor: brlOp(r.hibrido.custo_por_operacao), destaque: true } as { label: string; valor: string; destaque?: boolean });
    linhasHibrido.push({ label: `Crédito disponível para o comprador B2B (CBS ${pct2(r.cbs_ref_pct)} + IBS ${pct2(r.ibs_ref_pct)} integrais)`, valor: brlOp(r.hibrido.credito_comprador_b2b) });
    passos.push({
      titulo: "4. Regime Híbrido — sobre R$1.000 de venda",
      linhas: linhasHibrido,
      nota: `Crédito de entrada de ${creditoPct}% descontado do CBS e IBS (insumos que você compra). IS não entra na base do Simples Nacional.`,
    });

    // Passo 5: Break-even
    if (r.break_even_b2b_pct !== null) {
      const extra = r.hibrido.custo_por_operacao - r.normal.custo_por_operacao;
      const credB2b = r.hibrido.credito_comprador_b2b;
      passos.push({
        titulo: "5. Break-even B2B — a partir de quando o Híbrido vale",
        linhas: [
          { label: `Custo extra do Híbrido: R$1.000 × Híbrido − R$1.000 × Normal`, valor: brlOp(extra) },
          { label: `Crédito gerado por venda B2B no Híbrido`, valor: brlOp(credB2b) },
          { label: `Break-even = custo extra ÷ crédito B2B = ${brlOp(extra)} ÷ ${brlOp(credB2b)}`, valor: `${r.break_even_b2b_pct.toFixed(1)}% de clientes B2B`, destaque: true },
          { label: "Seu perfil informado", valor: `${r.percentual_b2b_atual.toFixed(0)}% de clientes B2B` },
          { label: "Resultado", valor: r.percentual_b2b_atual >= r.break_even_b2b_pct ? "Híbrido vantajoso" : "DAS Normal vantajoso", destaque: true },
        ],
        nota: "Lógica baseada em CalculoSimplesPorForaService.java — Calculadora RTC Simples Nacional (Receita Federal do Brasil).",
      });
    }
  } else {
    passos.push({
      titulo: "2. Situação em 2026 — dispensado",
      linhas: [
        { label: "CBS e IBS em vigor em 2026", valor: "Não" },
        { label: "DAS Normal e Híbrido são idênticos", valor: "Sim", destaque: true },
      ],
      nota: "LC 214/2025 dispensa o Simples Nacional de CBS e IBS em 2026. Use o ano para planejar: calcule o Fator R e mapeie seus clientes B2B.",
    });
  }

  return (
    <div className="border-t border-ink-100 px-6 pb-6 pt-4 space-y-5">
      <p className="text-[12px] text-ink-500">
        Todos os valores abaixo são calculados sobre R$1.000 de venda como base comparativa.
      </p>
      {passos.map((passo, pi) => (
        <div key={pi}>
          <div className="text-[12.5px] font-semibold text-ink-800 mb-2">{passo.titulo}</div>
          <table className="w-full text-[12px]">
            <tbody>
              {passo.linhas.map((l, li) => (
                <tr key={li} className={`border-b border-ink-100 last:border-0 ${l.destaque ? "bg-ink-50" : ""}`}>
                  <td className={`py-1.5 pr-4 leading-snug ${l.destaque ? "font-semibold text-ink-800" : "text-ink-600"}`}>{l.label}</td>
                  <td className={`py-1.5 text-right tab-num whitespace-nowrap ${l.destaque ? "font-bold text-ink-900" : "text-ink-700"}`}>{l.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {passo.nota && (
            <p className="mt-2 text-[11px] text-ink-400 leading-relaxed bg-ink-50 rounded-lg px-3 py-2">{passo.nota}</p>
          )}
        </div>
      ))}
      <p className="text-[11px] text-ink-400 pt-2 border-t border-ink-100">
        Base legal: LC 214/2025 (Arts. 350-357, 156-A CF/88, Art. 28) · CGSN Res. 190/2026 · NT 2026.005 Receita Federal
      </p>
    </div>
  );
}

// ─── Linha do tempo ───────────────────────────────────────────────────────────

function TimelineCard({ marcos, anoAtual }: { marcos: MarcoTimeline[]; anoAtual: number }) {
  return (
    <div className="rounded-2xl bg-white hairline px-6 py-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.10em] text-ink-500 mb-4">
        Calendário de decisões e obrigações
      </div>
      <div className="space-y-2">
        {marcos.map((m, i) => {
          const isAtual = m.ano === anoAtual;
          return (
            <div key={i} className={`flex gap-3 items-start rounded-lg px-3 py-2.5 ${isAtual ? "bg-brand-50 border border-brand-200" : "hover:bg-ink-50"}`}>
              <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${TIPO_DOT[m.tipo] ?? "bg-ink-300"}`} />
              <div className="flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="tab-num text-[12px] font-bold text-ink-800">
                    {m.ano}{m.mes ? ` / ${m.mes}` : ""}
                  </span>
                  <span className="text-[10.5px] text-ink-400">{TIPO_LABEL[m.tipo] ?? m.tipo}</span>
                </div>
                <p className={`text-[12px] leading-snug mt-0.5 ${m.destaque ? "text-ink-900 font-medium" : "text-ink-600"}`}>
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
