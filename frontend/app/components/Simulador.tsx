"use client";

import { useEffect, useState } from "react";
import type { Setor, SimulacaoResult } from "./types";
import { REGIMES, UFS, API } from "./types";
import { FieldLabel, SelectField, CurrencyField, parseBRL } from "./ui";
import TooltipGlossario from "./TooltipGlossario";
import Header, { type Aba } from "./Header";
import ResultadoSimulacao from "./ResultadoSimulacao";
import ComparadorRegimes from "./ComparadorRegimes";
import MarkupTab from "./MarkupTab";
import Onboarding from "./Onboarding";
import ChatAssistente from "./ChatAssistente";

const CREDITO_AUTO: Record<string, number> = {
  simples_nacional: 0,
  mei: 0,
  lucro_presumido: 30,
  lucro_real: 50,
};

export default function Simulador() {
  const [aba, setAba] = useState<Aba>("simulador");
  const [setores, setSetores] = useState<Setor[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<SimulacaoResult | null>(null);
  const [onboardingAberto, setOnboardingAberto] = useState(false);

  // Simulador inputs
  const [valor, setValor] = useState("");
  const [regime, setRegime] = useState("lucro_presumido");
  const [setorId, setSetorId] = useState("comercio_geral");
  const [uf, setUf] = useState("SP");
  const [ano, setAno] = useState(2029);
  const [creditoAvancado, setCreditoAvancado] = useState(false);
  const [credito, setCredito] = useState(30);
  const [faturamento, setFaturamento] = useState("360.000,00");
  const [folhaPagamento, setFolhaPagamento] = useState("");
  const [faturamentoMensal, setFaturamentoMensal] = useState("");
  const [despesasMensais, setDespesasMensais] = useState("");

  // Carrega setores
  useEffect(() => {
    fetch(`${API}/setores`)
      .then((r) => r.json())
      .then((d) => setSetores(d.setores))
      .catch(() =>
        setErro("Não foi possível conectar ao servidor. Certifique-se de que o backend está rodando em " + API)
      );
  }, []);

  // Onboarding (na primeira visita)
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("onboarding_feito")) {
      setOnboardingAberto(true);
    }
  }, []);

  // Auto-crédito
  useEffect(() => {
    if (!creditoAvancado) setCredito(CREDITO_AUTO[regime] ?? 30);
  }, [regime, creditoAvancado]);

  const setor = setores.find((s) => s.id === setorId);
  const meiBloqueado = regime === "mei" && setor?.mei_permitido === false;
  const mostrarFatorR =
    regime === "simples_nacional" && setor?.anexo_simples === "FATOR_R";
  const mostrarLucroReal = regime === "lucro_real";

  // Recalcula automaticamente ao mudar inputs (debounced).
  // Só calcula quando há valor preenchido — assim o site abre "zerado", sem puxar resultado.
  useEffect(() => {
    if (aba !== "simulador" || setores.length === 0 || meiBloqueado) return;
    const precisaFaturamento = regime === "simples_nacional" || regime === "mei";
    if (parseBRL(valor) <= 0 || (precisaFaturamento && parseBRL(faturamento) <= 0)) {
      setResultado(null);
      return;
    }
    const handler = setTimeout(() => {
      simular();
    }, 280);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, regime, setorId, uf, ano, credito, faturamento, folhaPagamento, faturamentoMensal, despesasMensais, setores, aba]);

  const simular = async () => {
    if (meiBloqueado) return;
    setCarregando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = {
        valor: parseBRL(valor),
        regime,
        setor_id: setorId,
        uf,
        ano,
        percentual_credito_entrada: credito / 100,
      };
      if (regime === "simples_nacional" || regime === "mei") {
        body.faturamento_anual = parseBRL(faturamento);
      }
      if (mostrarFatorR && folhaPagamento) {
        body.folha_pagamento_mensal = parseBRL(folhaPagamento);
      }
      if (mostrarLucroReal) {
        if (faturamentoMensal) body.faturamento_mensal = parseBRL(faturamentoMensal);
        if (despesasMensais) body.despesas_mensais = parseBRL(despesasMensais);
      }
      const res = await fetch(`${API}/simular`, {
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

  return (
    <div className="min-h-screen bg-ink-50">
      <Header aba={aba} setAba={setAba} onAbrirOnboarding={() => setOnboardingAberto(true)} />

      <main className="max-w-[1320px] mx-auto px-4 lg:px-6 pb-20">
        {aba === "simulador" && (
          <div className="grid lg:grid-cols-[400px_1fr] gap-6 mt-7">
            <FormPanel
              valor={valor} setValor={setValor}
              regime={regime} setRegime={setRegime}
              setorId={setorId} setSetorId={setSetorId}
              uf={uf} setUf={setUf}
              creditoAvancado={creditoAvancado} setCreditoAvancado={setCreditoAvancado}
              credito={credito} setCredito={setCredito}
              faturamento={faturamento} setFaturamento={setFaturamento}
              folhaPagamento={folhaPagamento} setFolhaPagamento={setFolhaPagamento}
              faturamentoMensal={faturamentoMensal} setFaturamentoMensal={setFaturamentoMensal}
              despesasMensais={despesasMensais} setDespesasMensais={setDespesasMensais}
              setores={setores}
              mostrarFatorR={mostrarFatorR}
              mostrarLucroReal={mostrarLucroReal}
              meiBloqueado={meiBloqueado}
              setor={setor}
              carregando={carregando}
              onAbrirOnboarding={() => setOnboardingAberto(true)}
            />

            <section className="space-y-6">
              {erro && (
                <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
                  {erro}
                </div>
              )}
              {resultado && (
                <ResultadoSimulacao resultado={resultado} ano={ano} setAno={setAno} />
              )}
              {!resultado && !erro && (
                <div className="rounded-2xl bg-white hairline px-7 py-16 text-center text-ink-400">
                  Preencha o <span className="font-semibold text-ink-600">valor da operação</span> ao lado para ver a simulação.
                </div>
              )}
            </section>
          </div>
        )}

        {aba === "markup" && (
          <MarkupTab setores={setores} ano={ano} setAno={setAno} sharedSetorId={setorId} sharedUf={uf} sharedRegime={regime} />
        )}

        {aba === "comparador" && (
          <ComparadorRegimes setores={setores} ano={ano} setAno={setAno} sharedSetorId={setorId} sharedUf={uf} />
        )}

        {aba === "base_legal" && (
          <div className="mt-6">
            <iframe
              src="/guia-reforma-tributaria.html"
              title="Guia completo da Reforma Tributária"
              className="w-full rounded-2xl border-0 shadow-sm"
              style={{ height: "calc(100vh - 160px)", minHeight: 600 }}
            />
          </div>
        )}

        {aba === "calculadora_dl" && (
          <div className="mt-6">
            <iframe
              src="/calculadora-dividendos.html"
              title="Calculadora de Lucros e Dividendos — Lei 15.270/2025"
              className="w-full rounded-2xl border-0 shadow-sm"
              style={{ height: "calc(100vh - 160px)", minHeight: 600 }}
            />
          </div>
        )}
      </main>

      {onboardingAberto && (
        <Onboarding
          onComplete={(cfg) => {
            if (cfg.regime) setRegime(cfg.regime);
            if (cfg.setorId) setSetorId(cfg.setorId);
            if (cfg.aba) setAba(cfg.aba);
            try { localStorage.setItem("onboarding_feito", "1"); } catch {}
            setOnboardingAberto(false);
          }}
          onSkip={() => {
            try { localStorage.setItem("onboarding_feito", "1"); } catch {}
            setOnboardingAberto(false);
          }}
        />
      )}

      <ChatAssistente />
    </div>
  );
}

/* ───────────────────────────── Form panel (left col) ───────── */
interface FormPanelProps {
  valor: string; setValor: (v: string) => void;
  regime: string; setRegime: (v: string) => void;
  setorId: string; setSetorId: (v: string) => void;
  uf: string; setUf: (v: string) => void;
  creditoAvancado: boolean; setCreditoAvancado: (v: boolean) => void;
  credito: number; setCredito: (v: number) => void;
  faturamento: string; setFaturamento: (v: string) => void;
  folhaPagamento: string; setFolhaPagamento: (v: string) => void;
  faturamentoMensal: string; setFaturamentoMensal: (v: string) => void;
  despesasMensais: string; setDespesasMensais: (v: string) => void;
  setores: Setor[];
  mostrarFatorR: boolean;
  mostrarLucroReal: boolean;
  meiBloqueado: boolean;
  setor: Setor | undefined;
  carregando: boolean;
  onAbrirOnboarding: () => void;
}

function FormPanel(p: FormPanelProps) {
  const showSimples = p.regime === "simples_nacional" || p.regime === "mei";
  return (
    <aside className="rounded-2xl bg-white hairline-strong p-6 lg:p-7 lg:sticky lg:top-6 self-start">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold">Calculadora</div>
          <h2 className="font-display text-[20px] font-bold text-ink-900 mt-0.5 leading-tight">Dados da operação</h2>
        </div>
        <button
          onClick={p.onAbrirOnboarding}
          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-500 hover:text-brand-600 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          Como funciona
        </button>
      </div>

      <div className="mb-5">
        <FieldLabel>Valor da operação</FieldLabel>
        <CurrencyField value={p.valor} onChange={p.setValor} />
        <p className="text-[12px] text-ink-400 mt-1.5 leading-snug">O valor de uma venda ou serviço típico.</p>
      </div>

      <div className="mb-5">
        <FieldLabel>
          <TooltipGlossario termo="lucro_presumido">Regime tributário</TooltipGlossario>
        </FieldLabel>
        <SelectField value={p.regime} onChange={p.setRegime}>
          {REGIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </SelectField>
        {p.meiBloqueado && (
          <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-[12px] text-red-700 leading-snug">
            <span className="font-semibold block">⛔ MEI não permitido para esta atividade</span>
            {p.setor?.mei_conselho
              ? `Profissão regulamentada pelo ${p.setor.mei_conselho}.`
              : p.setor?.mei_restricao === "escala_industrial"
                ? "Atividade de escala industrial."
                : "Atividade vedada pelo CGSN 140/2018."}
            {" "}Selecione outro regime.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="sm:col-span-2">
          <FieldLabel>Setor de atividade</FieldLabel>
          <SelectField value={p.setorId} onChange={p.setSetorId}>
            {p.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </SelectField>
          {(p.setor?.reducao_aliquota ?? 0) > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-600">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-400" />
              Redução setorial de {((p.setor!.reducao_aliquota) * 100).toFixed(0)}%
            </div>
          )}
        </div>
        <div>
          <FieldLabel>UF</FieldLabel>
          <SelectField value={p.uf} onChange={p.setUf}>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </SelectField>
        </div>
      </div>

      {showSimples && (
        <div className="mb-5 anim-in">
          <FieldLabel>Faturamento anual</FieldLabel>
          <CurrencyField value={p.faturamento} onChange={p.setFaturamento} />
          <p className="text-[12px] text-ink-400 mt-1.5">Define a faixa de alíquota do Simples.</p>
        </div>
      )}

      {p.mostrarFatorR && (
        <div className="mb-5 anim-in">
          <FieldLabel>
            Folha de pagamento mensal{" "}
            <span className="normal-case font-normal text-ink-400">(opcional)</span>
          </FieldLabel>
          <CurrencyField value={p.folhaPagamento} onChange={p.setFolhaPagamento} />
          <div className="mt-1.5 text-[11.5px] bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-700">
            ⚖️ <strong>Fator R:</strong> define Anexo III ou V do Simples.
          </div>
        </div>
      )}

      <div className="mb-5">
        <FieldLabel>
          <TooltipGlossario termo="credito_entrada">Crédito de entrada</TooltipGlossario>
        </FieldLabel>
        {!p.creditoAvancado ? (
          <div className="rounded-lg bg-brand-50 border border-brand-100 px-3.5 py-2.5 flex items-center justify-between">
            <div className="text-[13px] text-brand-700 leading-snug">
              Estimado:{" "}
              <strong className="tab-num text-brand-800">{CREDITO_AUTO[p.regime] ?? 30}%</strong>
              {showSimples && <span className="text-ink-400 block text-[11px]">Simples/MEI não geram crédito</span>}
            </div>
            <button
              onClick={() => p.setCreditoAvancado(true)}
              className="text-[12px] font-semibold text-brand-600 hover:text-brand-700 whitespace-nowrap"
            >Personalizar</button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[13px] font-semibold text-ink-700 tab-num">{p.credito}%</div>
              <button
                onClick={() => { p.setCreditoAvancado(false); p.setCredito(CREDITO_AUTO[p.regime] ?? 30); }}
                className="text-[11px] font-medium text-ink-400 hover:text-ink-700"
              >Voltar a automático</button>
            </div>
            <input
              type="range" min={0} max={80} step={5} value={p.credito}
              onChange={(e) => p.setCredito(parseInt(e.target.value))}
              className="rng w-full"
            />
          </div>
        )}
      </div>

      {p.mostrarLucroReal && (
        <div className="mb-5 anim-in rounded-lg bg-ink-50/70 border border-ink-100 p-3.5 space-y-3">
          <div className="text-[11px] uppercase tracking-[0.08em] text-ink-500 font-semibold">
            Apuração do Lucro Real{" "}
            <span className="normal-case font-normal text-ink-400">(opcional)</span>
          </div>
          <div>
            <FieldLabel>Faturamento médio mensal</FieldLabel>
            <CurrencyField value={p.faturamentoMensal} onChange={p.setFaturamentoMensal} />
          </div>
          <div>
            <FieldLabel>Despesas médias mensais</FieldLabel>
            <CurrencyField value={p.despesasMensais} onChange={p.setDespesasMensais} />
          </div>
          <p className="text-[11.5px] text-ink-400 leading-snug">
            Estima o <strong>IRPJ/CSLL</strong> sobre o lucro real (receita − despesas). Não altera o comparativo da reforma — que incide só sobre o consumo.
          </p>
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-ink-100 flex items-center gap-2 text-[12px] text-ink-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400" />
        </span>
        {p.carregando ? "Calculando…" : "Cálculo em tempo real"}
      </div>
    </aside>
  );
}
