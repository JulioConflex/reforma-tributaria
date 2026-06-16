"use client";

import { useState, type ReactNode } from "react";
import type { SimulacaoResult, DetalheTributo, FatorRInfo, IrpjCsllInfo, RecomendacaoItem, MemoriaCalculo } from "./types";
import { brl, NumberTicker, Sparkline, ValueBar, Chip, ConflexMark } from "./ui";
import TooltipGlossario from "./TooltipGlossario";
import TransitionTimeline, { CRONOGRAMA } from "./Timeline";

interface Props {
  resultado: SimulacaoResult;
  ano: number;
  setAno: (n: number) => void;
}

export default function ResultadoSimulacao({ resultado, ano, setAno }: Props) {
  return (
    <div className="space-y-6">
      <HeroDelta r={resultado} />
      <TransitionTimeline ano={ano} setAno={setAno} />

      {/* MEI incompatível */}
      {resultado.mei_incompativel && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5">
          <div className="font-bold text-red-800 text-[15px] mb-1">⛔ MEI não permitido para esta atividade</div>
          <p className="text-[13px] text-red-700 leading-relaxed">{resultado.mei_motivo}</p>
        </div>
      )}

      {/* Fator R */}
      {resultado.fator_r_info?.aplicavel && <FatorRCard info={resultado.fator_r_info} />}

      {/* Alerta */}
      {resultado.alerta && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-3.5 text-sm text-amber-800">
          {resultado.alerta}
        </div>
      )}

      {/* IS aviso */}
      {resultado.is_aplicavel && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-3.5 text-[13px] text-amber-900">
          <strong>⚠️ Imposto Seletivo — alíquotas estimadas:</strong>{" "}
          Os valores exibidos são estimativas de mercado. Decreto regulamentador ainda não publicado.
        </div>
      )}

      <Breakdown r={resultado} />

      {resultado.memoria_calculo && <MemoriaCalculoCard m={resultado.memoria_calculo} r={resultado} />}

      <NarrativeCard r={resultado} />

      {resultado.irpj_csll_info && <IrpjCsllCard info={resultado.irpj_csll_info} />}

      {resultado.recomendacoes?.length > 0 && <RecomendacoesCard recs={resultado.recomendacoes} />}

      <ProjectionDetail r={resultado} ano={ano} setAno={setAno} />

      <BaseLegal />
    </div>
  );
}

/* ─────────────────────────────────────────────── HERO ─── */
function HeroDelta({ r }: { r: SimulacaoResult }) {
  const aumento = r.economia_ou_acrescimo > 0;
  const diferencaAbs = Math.abs(r.economia_ou_acrescimo);
  const pctAbs = Math.abs(r.economia_percentual);

  const semafaro =
    pctAbs < 2  ? { label: "Impacto neutro", chip: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-400" } :
    aumento     ? { label: "Aumento de carga", chip: "bg-red-50 text-red-700 border-red-100", dot: "bg-red-500" } :
                  { label: "Redução de carga", chip: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" };

  // Sparkline data — backend já retorna projecao_2026_2033
  const sparkData = r.projecao_2026_2033.map((p) => ({
    ano: p.ano,
    percentual_sobre_valor: p.percentual_sobre_valor,
  }));
  const cronograma = CRONOGRAMA.find((c) => c.ano === r.ano);

  return (
    <div className="rounded-2xl overflow-hidden bg-white hairline">
      <div className="grid lg:grid-cols-12">
        <div className="lg:col-span-7 p-7 lg:p-9 border-r border-ink-100/70">
          <div className="flex items-center gap-2 mb-4">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${semafaro.chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${semafaro.dot}`} />
              {semafaro.label}
            </span>
            <span className="text-[11.5px] text-ink-400 font-medium">
              em {r.ano} · operação de {brl(r.valor_operacao)}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className={`font-display text-[64px] leading-none font-bold tab-num ${aumento ? "text-red-600" : "text-emerald-600"}`}>
              {aumento ? "+" : "−"}<NumberTicker value={diferencaAbs} />
            </span>
          </div>
          <div className="mt-2 text-ink-500 text-[14px]">
            por operação · <span className="font-semibold text-ink-700 tab-num">{aumento ? "+" : "−"}{pctAbs.toFixed(1)}%</span>
            <span className="ml-2 text-ink-400">{aumento ? "a mais" : "a menos"} que o sistema atual</span>
          </div>

          <div className="grid grid-cols-2 gap-5 mt-7 pt-6 border-t border-ink-100">
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400 font-semibold mb-1.5">Sistema atual</div>
              <div className="font-display text-[26px] font-bold text-ink-900 tab-num leading-tight">
                <NumberTicker value={r.sistema_atual.total} />
              </div>
              <div className="text-[12px] text-ink-500 mt-0.5 tab-num">
                {r.sistema_atual.percentual_sobre_valor.toFixed(2)}% do valor
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-brand-500 font-semibold mb-1.5">Novo sistema</div>
              <div className="font-display text-[26px] font-bold text-brand-800 tab-num leading-tight">
                <NumberTicker value={r.sistema_novo.total} />
              </div>
              <div className="text-[12px] text-brand-600 mt-0.5 tab-num">
                {r.sistema_novo.percentual_sobre_valor.toFixed(2)}% do valor
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-7 lg:p-9 mesh-bone">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold">Carga 2026 → 2033</div>
            <div className="text-[11px] font-mono text-ink-400 tab-num">% sobre operação</div>
          </div>
          <div className="mt-4">
            <Sparkline data={sparkData} currentAno={r.ano} w={420} h={130} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-ink-900 tab-num">
              {r.sistema_novo.percentual_sobre_valor.toFixed(1)}%
            </span>
            <span className="text-[12.5px] text-ink-500">em {r.ano}{cronograma ? ` · ${cronograma.fase}` : ""}</span>
          </div>
          {r.reducao_setor_aplicada > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-[11px] text-brand-700 font-semibold">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Redução setorial {r.reducao_setor_aplicada.toFixed(0)}% · LC 214/2025
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────── BREAKDOWN ─── */
function nomeFriendly(nome: string) {
  if (nome.startsWith("CBS")) return "CBS · Imposto federal novo";
  if (nome.startsWith("IBS")) return "IBS · Imposto est./mun. novo";
  if (nome.startsWith("IS")) return "IS · Imposto Seletivo";
  if (nome.startsWith("PIS")) return "PIS · contrib. federal";
  if (nome.startsWith("COFINS")) return "COFINS · contrib. federal";
  if (nome.startsWith("ICMS")) return nome.replace(/ICMS \((\w{2})\)/, "ICMS · estadual ($1)");
  if (nome.startsWith("ISS")) return "ISS · municipal";
  if (nome.startsWith("DAS")) return "DAS · Simples Nacional";
  return nome;
}

function Breakdown({ r }: { r: SimulacaoResult }) {
  const [showLegal, setShowLegal] = useState(false);
  const all = [...r.sistema_atual.detalhes, ...r.sistema_novo.detalhes];
  const max = Math.max(...all.map((i) => i.valor), 1);

  return (
    <div className="rounded-2xl bg-white hairline overflow-hidden">
      <div className="px-6 lg:px-7 pt-6 pb-4 flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold mb-0.5">Comparação detalhada</div>
          <h3 className="font-display text-[17px] font-bold text-ink-900 leading-tight">Tributo por tributo</h3>
        </div>
        <button
          onClick={() => setShowLegal((s) => !s)}
          className="text-[12px] font-medium text-ink-400 hover:text-brand-600 transition"
        >
          {showLegal ? "Ocultar cálculo" : "Ver cálculo e base legal"}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-ink-100">
        <BreakdownColumn
          title="Sistema atual"
          subtitle="Como você paga hoje"
          total={r.sistema_atual.total}
          pct={r.sistema_atual.percentual_sobre_valor}
          detalhes={r.sistema_atual.detalhes}
          max={max}
          showLegal={showLegal}
          color="#5F6E84"
        />
        <BreakdownColumn
          title="Novo sistema"
          subtitle="LC 214/2025 — IBS + CBS"
          total={r.sistema_novo.total}
          pct={r.sistema_novo.percentual_sobre_valor}
          detalhes={r.sistema_novo.detalhes}
          max={max}
          showLegal={showLegal}
          color="#01D1FF"
          highlight
        />
      </div>
    </div>
  );
}

function BreakdownColumn({
  title, subtitle, total, pct, detalhes, max, showLegal, color, highlight,
}: {
  title: string; subtitle: string; total: number; pct: number;
  detalhes: DetalheTributo[]; max: number; showLegal: boolean; color: string; highlight?: boolean;
}) {
  return (
    <div className={`px-6 lg:px-7 py-6 ${highlight ? "bg-gradient-to-br from-brand-50/40 to-transparent" : ""}`}>
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <div className={`text-[11px] uppercase tracking-[0.08em] font-semibold ${highlight ? "text-brand-600" : "text-ink-400"}`}>{title}</div>
          <div className="text-[12px] text-ink-500 mt-0.5">{subtitle}</div>
        </div>
        <div className="text-right">
          <div className={`font-display text-2xl font-bold tab-num ${highlight ? "text-brand-800" : "text-ink-900"}`}>{brl(total)}</div>
          <div className="text-[11.5px] text-ink-500 tab-num">{pct.toFixed(2)}% da operação</div>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {detalhes.map((d, i) => (
          <li key={i}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-ink-700">{nomeFriendly(d.nome)}</span>
              <span className="tab-num text-ink-500 shrink-0">
                <span className="text-ink-400">{d.aliquota_aplicada.toFixed(2)}%</span>
                <span className="mx-2 text-ink-200">·</span>
                <span className="font-semibold text-ink-800">{brl(d.valor)}</span>
              </span>
            </div>
            <div className="mt-1.5"><ValueBar value={d.valor} max={max} color={color} /></div>
            {showLegal && (
              <div className="mt-1 space-y-0.5">
                {d.formula && <div className="text-[10.5px] text-ink-500 font-mono leading-snug">{d.formula}</div>}
                <div className="text-[10.5px] text-ink-400 italic">{d.base_legal}</div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────────────────── MEMÓRIA DE CÁLCULO ─── */
function pctBR(x: number) {
  return (x * 100).toFixed(2).replace(".", ",") + "%";
}

function MemoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400 font-semibold mb-2">{title}</div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5">{children}</dl>
    </div>
  );
}

function MemoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-50 py-1">
      <dt className="text-[12.5px] text-ink-500">{k}</dt>
      <dd className="text-[12.5px] font-semibold text-ink-800 tab-num text-right">{v}</dd>
    </div>
  );
}

function MemoSteps({ title, detalhes, accent }: { title: string; detalhes: DetalheTributo[]; accent?: boolean }) {
  return (
    <div>
      <div className={`text-[11px] uppercase tracking-[0.08em] font-semibold mb-2 ${accent ? "text-brand-600" : "text-ink-400"}`}>{title}</div>
      <ul className="space-y-1.5">
        {detalhes.map((d, i) => (
          <li key={i} className="text-[12.5px] leading-snug">
            <span className="font-semibold text-ink-700">{nomeFriendly(d.nome)}: </span>
            <span className="text-ink-500 font-mono">{d.formula ?? brl(d.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MemoriaCalculoCard({ m, r }: { m: MemoriaCalculo; r: SimulacaoResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-white hairline overflow-hidden">
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full px-6 lg:px-7 py-5 flex items-center justify-between text-left"
      >
        <div>
          <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold mb-0.5">Transparência</div>
          <h3 className="font-display text-[17px] font-bold text-ink-900 leading-tight">Memória de cálculo</h3>
          <p className="text-[12.5px] text-ink-500 mt-0.5">Premissas e a fórmula de cada valor — para validar o resultado.</p>
        </div>
        <span className={`shrink-0 ml-4 w-7 h-7 rounded-full bg-ink-50 border border-ink-200 flex items-center justify-center text-ink-500 text-lg leading-none transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>

      {open && (
        <div className="px-6 lg:px-7 pb-7 space-y-6 anim-in">
          <MemoSection title="Premissas">
            <MemoRow k="Valor da operação" v={brl(m.valor_operacao)} />
            <MemoRow k="Regime" v={m.regime.replace(/_/g, " ")} />
            <MemoRow k="Setor" v={m.setor_nome} />
            <MemoRow k="UF · Ano" v={`${m.uf} · ${m.ano}`} />
            <MemoRow k="Crédito de entrada" v={pctBR(m.percentual_credito_entrada)} />
            {m.faturamento_mensal != null && <MemoRow k="Faturamento mensal" v={brl(m.faturamento_mensal)} />}
            {m.despesas_mensais != null && <MemoRow k="Despesas mensais" v={brl(m.despesas_mensais)} />}
          </MemoSection>

          <MemoSection title={`Fatores aplicados em ${m.ano}`}>
            <MemoRow k="CBS — alíquota de referência" v={pctBR(m.cbs_percentual)} />
            <MemoRow k="IBS — alíquota de referência" v={pctBR(m.ibs_percentual)} />
            <MemoRow k="ICMS vigente (transição)" v={pctBR(m.icms_fator)} />
            <MemoRow k="ISS vigente (transição)" v={pctBR(m.iss_fator)} />
            {m.reducao_setor > 0 && <MemoRow k="Redução setorial IBS/CBS" v={pctBR(m.reducao_setor)} />}
            <MemoRow k={`ICMS ${m.uf}`} v={pctBR(m.aliquota_icms_uf)} />
            {m.iss_setor > 0 && <MemoRow k="ISS do setor" v={pctBR(m.iss_setor)} />}
            <MemoRow k="PIS/COFINS vigentes" v={m.pis_cofins_ativo ? "Sim" : "Não (extintos)"} />
          </MemoSection>

          <MemoSteps title="Sistema atual — passo a passo" detalhes={r.sistema_atual.detalhes} />
          <MemoSteps title="Novo sistema (reforma) — passo a passo" detalhes={r.sistema_novo.detalhes} accent />

          {m.passos_irpj_csll.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400 font-semibold mb-2">IRPJ / CSLL — à parte (a reforma não altera)</div>
              <ul className="space-y-1.5">
                {m.passos_irpj_csll.map((p, i) => (
                  <li key={i} className="text-[12.5px] leading-snug">
                    <span className="font-semibold text-ink-700">{p.rotulo}: </span>
                    <span className="text-ink-500 font-mono">{p.formula}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {m.observacoes.length > 0 && (
            <ul className="pt-4 border-t border-ink-100 space-y-1.5">
              {m.observacoes.map((o, i) => (
                <li key={i} className="text-[11.5px] text-ink-400 leading-relaxed flex gap-2">
                  <span className="text-brand-400 shrink-0">•</span>{o}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────── NARRATIVE ─── */
function NarrativeCard({ r }: { r: SimulacaoResult }) {
  return (
    <div className="rounded-2xl bg-brand-800 mesh-navy text-ink-100 px-7 py-7 overflow-hidden relative">
      <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.13] pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/conflex-c.png" alt="" className="h-[240px] w-auto block" />
      </div>
      <div className="relative">
        <div className="flex flex-wrap gap-2 mb-4 text-[11px]">
          <Chip label="Setor" value={r.setor_nome} />
          <Chip label="Regime" value={r.regime.replace(/_/g, " ")} />
          <Chip label="UF" value={r.uf} />
          <Chip label="Ano" value={r.ano} />
          {r.reducao_setor_aplicada > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-400/20 border border-brand-400/30 text-brand-200 font-medium">
              Redução {r.reducao_setor_aplicada.toFixed(0)}% · LC 214/2025
            </span>
          )}
        </div>
        <p className="text-[15px] leading-[1.6] text-ink-100 max-w-3xl">{r.narrativa}</p>
        <div className="mt-4 text-[11.5px] text-brand-300 font-medium">{r.descricao_ano}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────── PROJECTION ─ */
function ProjectionDetail({ r, ano, setAno }: { r: SimulacaoResult; ano: number; setAno: (n: number) => void }) {
  return (
    <div className="rounded-2xl bg-white hairline px-6 lg:px-7 py-6">
      <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold mb-0.5">Projeção ano a ano</div>
      <h3 className="font-display text-[17px] font-bold text-ink-900 leading-tight mb-4">
        Como sua carga evolui de 2026 a 2033
      </h3>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.08em] text-ink-400 font-semibold">
              <th className="text-left py-2 px-2">Ano</th>
              <th className="text-left py-2 px-2 hidden sm:table-cell">Fase</th>
              <th className="text-right py-2 px-2">Total</th>
              <th className="text-right py-2 px-2">% op.</th>
              <th className="text-right py-2 px-2">Δ vs atual</th>
            </tr>
          </thead>
          <tbody>
            {r.projecao_2026_2033.map((p) => {
              const ativo = p.ano === ano;
              const negativa = p.diferenca < 0;
              return (
                <tr
                  key={p.ano}
                  onClick={() => setAno(p.ano)}
                  className={`cursor-pointer border-t border-ink-100 transition ${ativo ? "bg-brand-50/50 font-semibold" : "hover:bg-ink-50"}`}
                >
                  <td className="py-2.5 px-2 tab-num">
                    <span className={ativo ? "text-brand-700" : "text-ink-700"}>{p.ano}</span>
                    {ativo && <span className="ml-1.5 text-brand-400">●</span>}
                  </td>
                  <td className="py-2.5 px-2 text-ink-500 hidden sm:table-cell">{p.descricao}</td>
                  <td className="py-2.5 px-2 text-right tab-num text-ink-900">{brl(p.total_sistema_novo)}</td>
                  <td className="py-2.5 px-2 text-right tab-num text-ink-500">{p.percentual_sobre_valor.toFixed(2)}%</td>
                  <td className={`py-2.5 px-2 text-right tab-num font-semibold ${negativa ? "text-emerald-600" : "text-red-600"}`}>
                    {p.diferenca > 0 ? "+" : ""}{brl(p.diferenca)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-400 mt-3 pt-3 border-t border-ink-100">
        * Projeções baseadas em alíquotas de referência provisórias (CBS ~9,3% + IBS ~18,7%).
        Cronograma: LC 214/2025, Arts. 350–357.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────── FATOR R ─── */
function FatorRCard({ info }: { info: FatorRInfo }) {
  const semFolha = info.fator_r_calculado == null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-amber-600 text-lg mt-0.5">⚖️</span>
        <div>
          <h4 className="font-semibold text-amber-900 text-[14px]">Fator R — Qual Anexo do Simples se aplica?</h4>
          <p className="text-[12.5px] text-amber-800 mt-0.5 leading-relaxed">{info.mensagem}</p>
        </div>
      </div>

      {semFolha && info.cenario_iii && info.cenario_v && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-green-200 bg-white px-3 py-3">
            <div className="text-[11.5px] font-semibold text-green-700 mb-1">Cenário A — Fator R ≥ 28% → Anexo III</div>
            <div className="text-[20px] font-bold text-green-800 tab-num">{brl(info.cenario_iii.total)}</div>
            <div className="text-[11px] text-green-600">Alíquota efetiva: {info.cenario_iii.aliquota_efetiva.toFixed(2)}%</div>
          </div>
          <div className="rounded-lg border border-orange-200 bg-white px-3 py-3">
            <div className="text-[11.5px] font-semibold text-orange-700 mb-1">Cenário B — Fator R &lt; 28% → Anexo V</div>
            <div className="text-[20px] font-bold text-orange-800 tab-num">{brl(info.cenario_v.total)}</div>
            <div className="text-[11px] text-orange-600">Alíquota efetiva: {info.cenario_v.aliquota_efetiva.toFixed(2)}%</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────── IRPJ/CSLL ─ */
function IrpjCsllCard({ info }: { info: IrpjCsllInfo }) {
  if (info.incluido_no_das) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">✅</span>
        <div>
          <p className="font-semibold text-green-800 text-[14px]">IRPJ e CSLL já incluídos no DAS</p>
          <p className="text-[12.5px] text-green-700 mt-1">{info.mensagem_leigo}</p>
        </div>
      </div>
    );
  }
  if (info.estimavel) {
    const totalPct = (info.irpj_percentual ?? 0) + (info.csll_percentual ?? 0);
    const totalVal = (info.irpj_estimado ?? 0) + (info.csll_estimado ?? 0);
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">⚠️</span>
          <div>
            <p className="font-semibold text-amber-900 text-[14px]">
              IRPJ e CSLL <span className="underline decoration-dotted">não estão incluídos</span>
            </p>
            <p className="text-[12.5px] text-amber-800 mt-1 leading-relaxed">
              A Reforma não extingue o <TooltipGlossario termo="irpj">IRPJ</TooltipGlossario> e a <TooltipGlossario termo="csll">CSLL</TooltipGlossario>.
              Eles continuam sendo apurados sobre o lucro, separadamente.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-white/70 px-4 py-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded bg-amber-100 px-3 py-2 text-center">
            <p className="text-amber-700 font-medium">IRPJ</p>
            <p className="text-amber-900 font-bold mt-0.5 tab-num">≈ {brl(info.irpj_estimado ?? 0)}</p>
            <p className="text-amber-600 text-[10px] tab-num">{(info.irpj_percentual ?? 0).toFixed(2)}%</p>
          </div>
          <div className="rounded bg-amber-100 px-3 py-2 text-center">
            <p className="text-amber-700 font-medium">CSLL</p>
            <p className="text-amber-900 font-bold mt-0.5 tab-num">≈ {brl(info.csll_estimado ?? 0)}</p>
            <p className="text-amber-600 text-[10px] tab-num">{(info.csll_percentual ?? 0).toFixed(2)}%</p>
          </div>
          <div className="rounded bg-amber-200 px-3 py-2 text-center">
            <p className="text-amber-700 font-medium">Total</p>
            <p className="text-amber-900 font-bold mt-0.5 tab-num">≈ {brl(totalVal)}</p>
            <p className="text-amber-600 text-[10px] tab-num">{totalPct.toFixed(2)}%</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
      <span className="text-xl shrink-0 mt-0.5">⚠️</span>
      <div>
        <p className="font-semibold text-amber-900 text-[14px]">IRPJ e CSLL não estão incluídos</p>
        <p className="text-[12.5px] text-amber-800 mt-1">{info.mensagem_leigo}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────── RECS ──── */
function RecomendacoesCard({ recs }: { recs: RecomendacaoItem[] }) {
  const PRIO = {
    alta:  { chip: "bg-red-50 text-red-700 border-red-100",       label: "Prioridade alta" },
    media: { chip: "bg-amber-50 text-amber-700 border-amber-100", label: "Prioridade média" },
    baixa: { chip: "bg-ink-100 text-ink-600 border-ink-200",      label: "Acompanhamento" },
  } as const;
  return (
    <div className="rounded-2xl bg-white hairline px-6 lg:px-7 py-6">
      <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold mb-0.5">O que fazer agora</div>
      <h3 className="font-display text-[17px] font-bold text-ink-900 leading-tight mb-4">Próximos passos recomendados</h3>
      <ul className="grid sm:grid-cols-2 gap-3">
        {recs.map((r, i) => {
          const p = PRIO[r.prioridade];
          return (
            <li key={i} className="rounded-xl bg-ink-50/60 hairline p-4 flex gap-3">
              <div className="w-9 h-9 shrink-0 rounded-lg bg-white shadow-sm flex items-center justify-center text-[18px]">{r.icone}</div>
              <div className="min-w-0 flex-1">
                <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${p.chip} mb-1`}>{p.label}</span>
                <div className="text-[13.5px] font-semibold text-ink-900 leading-tight">{r.titulo}</div>
                <p className="text-[12.5px] text-ink-500 leading-relaxed mt-1">{r.texto}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 pt-4 border-t border-ink-100 text-[11.5px] text-ink-400">
        Simulação informativa. Consulte seu contador antes de tomar decisões estratégicas.
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────── BASE LEGAL ─── */
function BaseLegal() {
  const items = [
    { code: "LC 214/2025", label: "CBS, IBS, IS e cronograma 2026–2033" },
    { code: "EC 132/2023", label: "Reforma constitucional — IVA Dual" },
    { code: "LC 123/2006", label: "Simples Nacional e MEI" },
    { code: "LC 116/2003", label: "ISS (vigente até extinção gradual)" },
  ];
  return (
    <div className="rounded-2xl bg-white hairline px-6 lg:px-7 py-6">
      <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold mb-0.5">Base legal</div>
      <h3 className="font-display text-[15px] font-bold text-ink-900 leading-tight mb-4">Marcos legais utilizados nos cálculos</h3>
      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {items.map((i) => (
          <li key={i.code} className="flex items-baseline gap-3">
            <span className="font-mono text-[11.5px] font-semibold text-brand-700 tab-num">{i.code}</span>
            <span className="text-[12.5px] text-ink-600">{i.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 pt-4 border-t border-ink-100 text-[11.5px] text-ink-400 leading-relaxed">
        Alíquotas de referência do IBS (~18,7%) e CBS (~9,3%) são estimativas sujeitas a resolução do Senado Federal.
      </p>
    </div>
  );
}
