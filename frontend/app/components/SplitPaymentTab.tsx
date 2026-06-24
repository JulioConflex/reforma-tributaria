"use client";

import { useEffect, useState } from "react";
import type { Setor, SimulacaoResult, DetalheTributo } from "./types";
import { REGIMES, UFS, API } from "./types";
import { FieldLabel, SelectField, CurrencyField, parseBRL, brl, NumberTicker } from "./ui";

const CREDITO_AUTO: Record<string, number> = {
  simples_nacional: 0, mei: 0, lucro_presumido: 30, lucro_real: 50,
};

const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

interface Props {
  setores: Setor[];
}

export default function SplitPaymentTab({ setores }: Props) {
  const [valor, setValor] = useState("");
  const [regime, setRegime] = useState("lucro_presumido");
  const [setorId, setSetorId] = useState("comercio_geral");
  const [uf, setUf] = useState("SP");
  const [ano, setAno] = useState(2029);
  const [credito, setCredito] = useState(30);

  const [result, setResult] = useState<SimulacaoResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    setCredito(CREDITO_AUTO[regime] ?? 30);
  }, [regime]);

  useEffect(() => {
    if (setores.length === 0 || !valor) return;
    const t = setTimeout(() => calcular(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, regime, setorId, uf, ano, credito, setores.length]);

  const calcular = async () => {
    const v = parseBRL(valor);
    if (v <= 0) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`${API}/simular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor: v,
          regime,
          setor_id: setorId,
          uf,
          ano,
          percentual_credito_entrada: credito / 100,
        }),
      });
      if (!res.ok) throw new Error("Erro ao calcular");
      setResult(await res.json());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  };

  // Extrai IBS e CBS do resultado
  const ibs = result?.sistema_novo.detalhes.find((d: DetalheTributo) => d.nome.includes("IBS"));
  const cbs = result?.sistema_novo.detalhes.find((d: DetalheTributo) => d.nome.includes("CBS"));
  const totalRetido = (ibs?.valor ?? 0) + (cbs?.valor ?? 0);
  const valorLiquido = (result?.valor_operacao ?? 0) - totalRetido;
  const pctRetido = result && result.valor_operacao > 0
    ? (totalRetido / result.valor_operacao) * 100
    : 0;

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 mt-7">
      {/* ── Formulário ── */}
      <aside className="rounded-2xl bg-white hairline-strong p-6 lg:p-7 lg:sticky lg:top-6 self-start">
        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold">Retenção automática</div>
          <h2 className="font-display text-[20px] font-bold text-ink-900 mt-0.5 leading-tight">Split Payment</h2>
          <p className="text-[12.5px] text-ink-500 mt-1.5 leading-snug">
            Quanto o banco retém automaticamente na hora do pagamento.
          </p>
        </div>

        <div className="mb-4">
          <FieldLabel>Valor da nota / operação</FieldLabel>
          <CurrencyField value={valor} onChange={setValor} placeholder="100.000,00" />
        </div>

        <div className="mb-4">
          <FieldLabel>Regime tributário</FieldLabel>
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
          <FieldLabel>Ano</FieldLabel>
          <SelectField value={String(ano)} onChange={(v) => setAno(parseInt(v))}>
            {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
          </SelectField>
        </div>

        <div className="mb-4">
          <FieldLabel>Crédito de entrada estimado</FieldLabel>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[13px] font-semibold text-ink-700 tab-num">{credito}%</span>
          </div>
          <input
            type="range" min={0} max={80} step={5} value={credito}
            onChange={(e) => setCredito(parseInt(e.target.value))}
            className="rng w-full"
          />
          <p className="text-[11px] text-ink-400 mt-1.5 leading-snug">
            Seus créditos de IBS/CBS sobre compras reduzem o imposto líquido. O banco retém o bruto; você recupera via compensação.
          </p>
        </div>

        <div className="mt-6 pt-5 border-t border-ink-100 flex items-center gap-2 text-[12px] text-ink-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400" />
          </span>
          {carregando ? "Calculando…" : "Recalculando em tempo real"}
        </div>
      </aside>

      {/* ── Resultado ── */}
      <section className="space-y-5">
        {erro && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{erro}</div>
        )}

        {!result && !erro && (
          <div className="rounded-2xl bg-white hairline flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#01D1FF" strokeWidth="2">
                <path d="M12 2v20M2 12h20" />
              </svg>
            </div>
            <p className="text-[14px] text-ink-500 max-w-xs">Digite o valor da nota para ver quanto será retido automaticamente pelo Split Payment.</p>
          </div>
        )}

        {result && (
          <>
            {/* Hero — retenção */}
            <div className="rounded-2xl bg-brand-800 mesh-navy text-ink-100 overflow-hidden relative">
              <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.10] pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/conflex-c.png" alt="" className="h-[220px] w-auto block" />
              </div>
              <div className="relative grid lg:grid-cols-[1fr,auto] gap-6 items-center p-7 lg:p-9">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.10em] text-brand-300 font-semibold mb-1">
                    Retido automaticamente · {ano}
                  </div>
                  <div className="font-display text-[52px] leading-none font-bold text-white tab-num">
                    <NumberTicker value={totalRetido} />
                  </div>
                  <p className="text-[14px] text-ink-200 mt-3 leading-relaxed max-w-md">
                    De cada <strong className="text-white tab-num">{brl(result.valor_operacao)}</strong> recebido,
                    o banco separa <strong className="text-brand-300 tab-num">{brl(totalRetido)}</strong> direto
                    para o governo antes de depositar na sua conta.
                  </p>
                </div>
                <div className="relative w-[150px] h-[150px] shrink-0 mx-auto">
                  <RetencaoDonut pct={pctRetido} />
                </div>
              </div>
            </div>

            {/* Breakdown IBS + CBS */}
            <div className="rounded-2xl bg-white hairline overflow-hidden">
              <div className="px-6 lg:px-7 pt-6 pb-2 border-b border-ink-100/70">
                <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold mb-0.5">Composição da retenção</div>
                <h3 className="font-display text-[17px] font-bold text-ink-900">IBS + CBS detalhados</h3>
              </div>

              <div className="divide-y divide-ink-100/60">
                {[
                  { label: "IBS — Imposto sobre Bens e Serviços", tributo: ibs, cor: "#01D1FF", desc: "Estadual + municipal. Retido na fonte pelo intermediador de pagamento." },
                  { label: "CBS — Contribuição sobre Bens e Serviços", tributo: cbs, cor: "#6366F1", desc: "Federal. Substitui PIS e COFINS. Também retido na fonte." },
                ].map(({ label, tributo, cor, desc }) => (
                  <div key={label} className="px-6 lg:px-7 py-5 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cor }} />
                        <span className="text-[13px] font-semibold text-ink-900">{label}</span>
                      </div>
                      <p className="text-[12px] text-ink-500 leading-snug ml-[18px]">{desc}</p>
                      <div className="mt-2 ml-[18px]">
                        <BarraTributo valor={tributo?.valor ?? 0} max={totalRetido > 0 ? totalRetido : 1} cor={cor} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-[20px] font-bold tab-num text-ink-900">{brl(tributo?.valor ?? 0)}</div>
                      <div className="text-[12px] text-ink-400 tab-num">{((tributo?.aliquota_aplicada ?? 0) * 100).toFixed(2)}% efetivo</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fluxo de caixa */}
            <div className="rounded-2xl bg-white hairline px-6 lg:px-7 py-6">
              <div className="text-[11px] uppercase tracking-[0.10em] text-ink-500 font-semibold mb-0.5">Fluxo de caixa</div>
              <h3 className="font-display text-[17px] font-bold text-ink-900 mb-5">O que entra na sua conta</h3>

              <div className="space-y-3">
                <LinhaFluxo label="Valor da nota (cobrado do cliente)" valor={result.valor_operacao} tipo="neutro" />
                <LinhaFluxo label={`IBS retido (${ano})`} valor={-(ibs?.valor ?? 0)} tipo="saida" />
                <LinhaFluxo label={`CBS retida (${ano})`} valor={-(cbs?.valor ?? 0)} tipo="saida" />
                <div className="border-t border-ink-200 pt-3">
                  <LinhaFluxo label="Valor líquido depositado na conta" valor={valorLiquido} tipo="entrada" destaque />
                </div>
              </div>

              {credito > 0 && (
                <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                  <div className="text-[12px] font-semibold text-emerald-800 mb-0.5">+ Crédito de entrada estimado ({credito}%)</div>
                  <p className="text-[12px] text-emerald-700 leading-snug">
                    Você pode recuperar <strong className="tab-num">{brl(totalRetido * credito / 100)}</strong> via compensação na apuração mensal — o banco retém o bruto, mas seus créditos de compras reduzem o saldo devedor.
                  </p>
                </div>
              )}
            </div>

            {/* Aviso legal */}
            <div className="rounded-2xl bg-amber-50 border border-amber-100 px-5 py-4 text-[12.5px] text-amber-800 leading-relaxed">
              <strong>Atenção:</strong> o Split Payment passa a vigorar a partir de 2029 (Art. 50 LC 214/2025). Para 2026–2028 os tributos de transição ainda são recolhidos pelo próprio contribuinte. Os valores acima refletem a alíquota do ano selecionado.
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function RetencaoDonut({ pct }: { pct: number }) {
  const c = 75, r = 58, stroke = 18;
  const circ = 2 * Math.PI * r;
  const ofs = circ * (1 - pct / 100);
  return (
    <svg viewBox="0 0 150 150" className="w-full h-full">
      <circle cx={c} cy={c} r={r} stroke="rgba(255,255,255,.10)" strokeWidth={stroke} fill="none" />
      <circle cx={c} cy={c} r={r} stroke="#01D1FF" strokeWidth={stroke} fill="none"
        strokeDasharray={circ} strokeDashoffset={ofs}
        transform={`rotate(-90 ${c} ${c})`} strokeLinecap="round" />
      <text x={c} y={c - 5} textAnchor="middle" fill="#fff" fontSize="24" fontWeight="700" className="tab-num">
        {pct.toFixed(1)}%
      </text>
      <text x={c} y={c + 14} textAnchor="middle" fill="#56DEFF" fontSize="9" fontWeight="600" letterSpacing="1.5">
        RETIDO
      </text>
    </svg>
  );
}

function BarraTributo({ valor, max, cor }: { valor: number; max: number; cor: string }) {
  const w = max > 0 ? Math.min(100, (valor / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full overflow-hidden bg-ink-100 w-full max-w-xs">
      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: cor }} />
    </div>
  );
}

function LinhaFluxo({ label, valor, tipo, destaque }: { label: string; valor: number; tipo: "neutro" | "saida" | "entrada"; destaque?: boolean }) {
  const cor = tipo === "saida" ? "text-red-600" : tipo === "entrada" ? "text-emerald-700" : "text-ink-700";
  const prefix = tipo === "saida" ? "−" : tipo === "entrada" ? "+" : "";
  const absValor = Math.abs(valor);
  return (
    <div className={`flex items-center justify-between gap-4 ${destaque ? "rounded-xl bg-ink-50/80 hairline px-4 py-3" : "px-1"}`}>
      <span className={`text-[13px] ${destaque ? "font-semibold text-ink-900" : "text-ink-600"}`}>{label}</span>
      <span className={`font-display tab-num font-bold ${destaque ? "text-[20px]" : "text-[15px]"} ${cor}`}>
        {prefix}{brl(absValor)}
      </span>
    </div>
  );
}
