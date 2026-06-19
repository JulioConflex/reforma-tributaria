"use client";

import { useEffect, useState } from "react";
import type { Setor, MarkupResult } from "./types";
import { REGIMES, UFS, API } from "./types";
import { FieldLabel, TextField, SelectField, NumberTicker, brl, CurrencyField, parseBRL } from "./ui";
import TooltipGlossario from "./TooltipGlossario";
import TransitionTimeline from "./Timeline";

const CREDITO_AUTO: Record<string, number> = {
  simples_nacional: 0, mei: 0, lucro_presumido: 30, lucro_real: 50,
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
  const [custo, setCusto] = useState("5.000,00");
  const [margem, setMargem] = useState("30");
  const [despesas, setDespesas] = useState("10");
  const [regime, setRegime] = useState(sharedRegime || "lucro_presumido");
  const [setorId, setSetorId] = useState(sharedSetorId || "comercio_geral");
  const [uf, setUf] = useState(sharedUf || "SP");
  const [creditoAvancado, setCreditoAvancado] = useState(false);
  const [credito, setCredito] = useState(30);

  const [result, setResult] = useState<MarkupResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!creditoAvancado) setCredito(CREDITO_AUTO[regime] ?? 30);
  }, [regime, creditoAvancado]);

  // Debounced recalc
  useEffect(() => {
    if (setores.length === 0) return;
    const t = setTimeout(() => calcular(), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custo, margem, despesas, regime, setorId, uf, ano, credito, setores.length]);

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

  const aumento = (result?.diferenca_preco ?? 0) > 0;
  const aumentoPct = (result && result.preco_venda_sistema_atual > 0)
    ? (result.diferenca_preco / result.preco_venda_sistema_atual) * 100
    : 0;

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 mt-7">
      {/* ── Form ── */}
      <aside className="rounded-2xl bg-white hairline-strong p-6 lg:p-7 lg:sticky lg:top-6 self-start">
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

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <FieldLabel>Margem desejada</FieldLabel>
            <TextField type="number" suffix="%" value={margem} onChange={setMargem} />
          </div>
          <div>
            <FieldLabel>Despesas fixas</FieldLabel>
            <TextField type="number" suffix="%" value={despesas} onChange={setDespesas} />
          </div>
        </div>

        <div className="mb-4">
          <FieldLabel>
            <TooltipGlossario termo="lucro_presumido">Regime tributário</TooltipGlossario>
          </FieldLabel>
          <SelectField value={regime} onChange={setRegime}>
            {REGIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </SelectField>
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
                <button onClick={() => { setCreditoAvancado(false); setCredito(CREDITO_AUTO[regime] ?? 30); }} className="text-[11px] font-medium text-ink-400 hover:text-ink-700">Voltar</button>
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
      <section className="space-y-6">
        {erro && <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{erro}</div>}

        {result && (
          <>
            <TransitionTimeline ano={ano} setAno={setAno} />

            {/* Hero */}
            <div className="rounded-2xl bg-white hairline overflow-hidden">
              <div className="grid lg:grid-cols-12">
                <div className="lg:col-span-7 p-7 lg:p-9 border-r border-ink-100/70">
                  <div className="flex items-center gap-2 mb-4">
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

                  <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400 font-semibold mb-2">Você deve cobrar</div>
                  <div className="font-display text-[56px] leading-none font-bold tab-num text-brand-800">
                    <NumberTicker value={result.preco_venda_sistema_novo} />
                  </div>
                  <div className="mt-3 text-[13px] text-ink-500">
                    Markup <strong className="tab-num text-ink-700">{result.markup_novo.toFixed(2)}×</strong>{" "}
                    sobre o custo de <strong className="tab-num text-ink-700">{brl(parseBRL(custo))}</strong>
                  </div>

                  <div className="mt-6 rounded-xl bg-ink-50/70 hairline px-4 py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400 font-semibold mb-1">Hoje você cobraria</div>
                      <div className="font-display text-[20px] font-bold text-ink-700 tab-num">{brl(result.preco_venda_sistema_atual)}</div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#01D1FF" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-[0.08em] text-brand-500 font-semibold mb-1">Diferença</div>
                      <div className={`font-display text-[20px] font-bold tab-num ${aumento ? "text-red-600" : "text-emerald-600"}`}>
                        {aumento ? "+" : "−"}{brl(Math.abs(result.diferenca_preco))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Carga sparkline */}
                <div className="lg:col-span-5 p-7 lg:p-9 mesh-bone">
                  <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold mb-1">Carga tributária</div>
                  <h3 className="font-display text-[15px] font-bold text-ink-900 mb-4">Atual vs com reforma</h3>

                  <div className="space-y-3.5">
                    <CargaBar label="Sistema atual" pct={result.carga_tributaria_atual_percentual} color="#5F6E84"
                      max={Math.max(result.carga_tributaria_atual_percentual, result.carga_tributaria_nova_percentual) + 5} />
                    <CargaBar label={`Em ${ano}`} pct={result.carga_tributaria_nova_percentual} color="#01D1FF"
                      max={Math.max(result.carga_tributaria_atual_percentual, result.carga_tributaria_nova_percentual) + 5} highlight />
                  </div>

                  <div className="mt-5 pt-4 border-t border-ink-100/60 text-[11.5px] text-ink-500 leading-relaxed">
                    Cálculo &quot;por fora&quot; — PV = Custo ÷ (1 − Margem − Despesas − Carga).
                  </div>
                </div>
              </div>
            </div>

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
