"use client";

import { useState } from "react";
import Image from "next/image";

interface OnboardingConfig {
  regime?: string;
  setorId?: string;
  aba?: "simulador" | "markup" | "comparador";
}

interface Props {
  onComplete: (cfg: OnboardingConfig) => void;
  onSkip: () => void;
}

const PORTES = [
  { id: "mei",     titulo: "MEI / Autônomo",  desc: "Faturamento até R$ 81 mil/ano",        regime: "mei",              icon: "👤" },
  { id: "pequena", titulo: "Pequena empresa", desc: "Até R$ 4,8 mi/ano · Simples Nacional", regime: "simples_nacional", icon: "🏪" },
  { id: "media",   titulo: "Média ou grande", desc: "Acima de R$ 4,8 mi/ano",               regime: "lucro_presumido",  icon: "🏢" },
];
const ATIVIDADES = [
  { id: "produtos",    titulo: "Vendo produtos",   setor: "comercio_geral",     icon: "📦" },
  { id: "servicos",    titulo: "Presto serviços",  setor: "servicos_ti",        icon: "🛠️" },
  { id: "saude",       titulo: "Saúde / Clínicas", setor: "saude_clinicas",     icon: "⚕️" },
  { id: "alimentacao", titulo: "Alimentação",      setor: "restaurantes_bares", icon: "🍽️" },
];
const OBJETIVOS = [
  { id: "carga",  titulo: "Quanto vou pagar de imposto?",  desc: "Calcular tributos por operação",          aba: "simulador"  as const },
  { id: "regime", titulo: "Devo mudar de regime?",         desc: "Comparar Simples, Presumido, Real e MEI", aba: "comparador" as const },
  { id: "preco",  titulo: "Como ajustar meu preço?",       desc: "Recalcular markup para manter a margem",  aba: "markup"     as const },
];

type Step = 1 | 2 | 3 | 4 | 5;
type WizStep = 1 | 2 | 3;

export default function Onboarding({ onComplete, onSkip }: Props) {
  const [step, setStep]       = useState<Step>(1);
  const [wizStep, setWizStep] = useState<WizStep>(1);
  const [porte, setPorte]     = useState("media");
  const [atividade, setAtividade] = useState("produtos");

  const concluir = (obj: (typeof OBJETIVOS)[number]) => {
    const regime  = PORTES.find((p) => p.id === porte)?.regime;
    const setorId = ATIVIDADES.find((a) => a.id === atividade)?.setor;
    onComplete({ regime, setorId, aba: obj.aba });
  };

  const irParaConfig = () => { setStep(5); setWizStep(1); };

  const headerSub =
    step < 5 ? `Tela ${step} de 4 · entenda a reforma` : "Configure seu perfil (opcional)";

  return (
    <div className="fixed inset-0 z-50 bg-brand-800/70 backdrop-blur-sm flex items-center justify-center p-4 anim-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Header fixo ── */}
        <div className="mesh-navy px-7 py-6 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/conflex-logo.webp" alt="Conflex" width={100} height={24} className="h-5 w-auto block" />
              <span className="h-4 w-px bg-white/20" />
              <div>
                <h2 className="font-display text-[18px] font-bold leading-tight">Como funciona</h2>
                <p className="text-brand-300 text-[11.5px] mt-0.5">{headerSub}</p>
              </div>
            </div>
            {step < 5 ? (
              <button onClick={irParaConfig} className="text-[12px] text-brand-300 hover:text-white transition">
                Pular explicação
              </button>
            ) : (
              <button onClick={onSkip} className="text-[12px] text-brand-300 hover:text-white transition">
                Entrar sem configurar
              </button>
            )}
          </div>
          <div className="mt-5 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= step ? "bg-brand-400" : "bg-white/15"}`} />
            ))}
          </div>
        </div>

        {/* ── Conteúdo scrollável ── */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {step === 1 && <SlideReforma />}
          {step === 2 && <SlideMudancas />}
          {step === 3 && <SlideSimulador />}
          {step === 4 && <SlideInterpretar />}
          {step === 5 && (
            <WizardConfig
              wizStep={wizStep} setWizStep={setWizStep}
              porte={porte} setPorte={setPorte}
              atividade={atividade} setAtividade={setAtividade}
              concluir={concluir}
            />
          )}
        </div>

        {/* ── Rodapé de navegação (só nas telas informativas) ── */}
        {step < 5 && (
          <div className="shrink-0 px-7 py-4 border-t border-ink-100 flex items-center justify-between bg-white">
            {step > 1 ? (
              <button
                onClick={() => setStep((step - 1) as Step)}
                className="text-[12.5px] text-ink-500 hover:text-ink-900 font-medium inline-flex items-center gap-1 transition"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Voltar
              </button>
            ) : <div />}
            <button
              onClick={() => step < 4 ? setStep((step + 1) as Step) : irParaConfig()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-semibold px-4 py-2 transition"
            >
              {step < 4 ? "Próximo" : "Configurar perfil"}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Slide 1: O que é a Reforma Tributária ── */
function SlideReforma() {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">Tela 1 de 4</div>
        <h3 className="font-display text-[20px] font-bold text-ink-900 leading-tight">O que é a Reforma Tributária?</h3>
      </div>
      <p className="text-[14px] text-ink-600 leading-relaxed">
        A partir de 2026, o Brasil começa a substituir cinco tributos sobre consumo por um sistema unificado,{" "}
        <strong>mais simples, mais transparente e com menos burocracia</strong>.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-red-50 border border-red-100 p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-red-500 font-semibold mb-3">O que sai</div>
          <div className="space-y-2 text-[13px] text-ink-700">
            {["PIS e COFINS (federais)", "ICMS (estadual)", "ISS (municipal)", "IPI (industrial)"].map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className="text-red-400 font-bold text-[10px]">✕</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-100 p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-green-600 font-semibold mb-3">O que entra</div>
          <div className="space-y-2.5 text-[13px]">
            <div className="flex items-start gap-2">
              <span className="shrink-0 rounded bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-bold mt-0.5">CBS</span>
              <span className="text-ink-700">Federal, substitui PIS/COFINS</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 rounded bg-green-100 text-green-700 px-1.5 py-0.5 text-[10px] font-bold mt-0.5">IBS</span>
              <span className="text-ink-700">Estadual/municipal, substitui ICMS/ISS</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-bold mt-0.5">IS</span>
              <span className="text-ink-700">Seletivo, para cigarro, bebidas e armas</span>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-[12.5px] text-amber-800 leading-snug">
        ⏳ A mudança é <strong>gradual</strong>: os dois sistemas convivem de 2026 a 2033. O simulador mostra o impacto em cada ano da transição.
      </div>
    </div>
  );
}

/* ── Slide 2: O que muda para a empresa ── */
function SlideMudancas() {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">Tela 2 de 4</div>
        <h3 className="font-display text-[20px] font-bold text-ink-900 leading-tight">O que muda para a sua empresa?</h3>
      </div>
      <p className="text-[14px] text-ink-600 leading-relaxed">
        A principal mudança é o <strong>crédito de imposto</strong>: no novo sistema, o imposto que você paga nas compras
        pode ser abatido do imposto que você deve nas vendas.
      </p>
      <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 space-y-3">
        <div className="text-[11.5px] font-semibold text-brand-600 uppercase tracking-[0.08em]">Exemplo prático</div>
        <div className="space-y-2.5 text-[13px] text-ink-700">
          <div className="flex items-start gap-2">
            <span className="text-brand-500 mt-0.5 shrink-0">→</span>
            <span>
              Comprou R$ 10.000 em mercadoria e pagou R$ 2.650 de CBS+IBS?{" "}
              <strong>Esse valor vira crédito</strong> para abater nas vendas.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-brand-500 mt-0.5 shrink-0">→</span>
            <span>
              Vendeu R$ 20.000? Calcula CBS+IBS sobre R$ 20.000, <strong>desconta o crédito acumulado</strong>{" "}
              e paga só a diferença.
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[13px]">
        <div className="rounded-xl border border-green-200 bg-green-50 p-3.5">
          <div className="font-semibold text-green-700 mb-2">Setores com benefício</div>
          <div className="text-ink-600 space-y-1 leading-snug">
            <div>⚕️ Saúde: redução de 60%</div>
            <div>📚 Educação: redução de 60%</div>
            <div>🥦 Alimentos básicos: isenção</div>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <div className="font-semibold text-amber-700 mb-2">Atenção</div>
          <div className="text-ink-600 leading-snug">
            Simples Nacional e MEI têm regras próprias. O simulador calcula a situação específica de cada regime.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Slide 3: O que o simulador calcula ── */
function SlideSimulador() {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">Tela 3 de 4</div>
        <h3 className="font-display text-[20px] font-bold text-ink-900 leading-tight">O que este simulador calcula?</h3>
      </div>
      <p className="text-[14px] text-ink-600 leading-relaxed">
        Para uma operação (um produto ou serviço que você vende), o simulador compara{" "}
        <strong>o imposto que você paga hoje com o que vai pagar com a reforma</strong>.
      </p>
      <div className="rounded-xl border border-ink-150 overflow-hidden text-[13px]">
        <div className="grid grid-cols-3 bg-ink-50">
          <div className="px-3.5 py-2.5 text-ink-500 font-semibold text-[12px]"></div>
          <div className="px-3.5 py-2.5 text-ink-700 font-semibold text-[12px] border-l border-ink-150">Sistema atual</div>
          <div className="px-3.5 py-2.5 text-brand-700 font-semibold text-[12px] border-l border-ink-150 bg-brand-50">Com a reforma</div>
        </div>
        <div className="grid grid-cols-3 border-t border-ink-100">
          <div className="px-3.5 py-3 text-ink-500 font-medium text-[12px]">Tributos</div>
          <div className="px-3.5 py-3 text-ink-700 border-l border-ink-100 leading-snug text-[12px]">PIS, COFINS, ICMS ou ISS, IRPJ/CSLL</div>
          <div className="px-3.5 py-3 text-brand-700 border-l border-ink-100 leading-snug text-[12px] bg-brand-50/30">CBS + IBS (+ IS se aplicável)</div>
        </div>
        <div className="grid grid-cols-3 border-t border-ink-100">
          <div className="px-3.5 py-3 text-ink-500 font-medium text-[12px]">O resultado</div>
          <div className="px-3.5 py-3 text-ink-700 border-l border-ink-100 text-[12px]">Ex: 18,5% do valor</div>
          <div className="px-3.5 py-3 text-brand-700 border-l border-ink-100 text-[12px] bg-brand-50/30">Ex: 14,2% do valor</div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-500 font-semibold">Use as abas para ir além:</div>
        {[
          { icon: "📊", label: "Simulador", desc: "Detalha cada tributo da operação e projeta de 2026 a 2033" },
          { icon: "⚖️", label: "Comparador", desc: "Simples, Presumido, Real e MEI lado a lado" },
          { icon: "🏷️", label: "Markup",    desc: "Calcula como ajustar o preço para manter a margem" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-lg border border-ink-100 px-3.5 py-2.5 text-[13px]">
            <span className="text-[18px]">{item.icon}</span>
            <span>
              <span className="font-semibold text-ink-800">{item.label}</span>
              <span className="text-ink-500">: {item.desc}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Slide 4: Como interpretar os resultados ── */
function SlideInterpretar() {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">Tela 4 de 4</div>
        <h3 className="font-display text-[20px] font-bold text-ink-900 leading-tight">Como interpretar os resultados?</h3>
      </div>
      <div className="space-y-3">
        {[
          {
            icon: "🟢",
            titulo: "Economia",
            desc: "Com a reforma, você vai pagar menos imposto nessa operação. Quanto menor o percentual novo, maior o benefício.",
          },
          {
            icon: "🔴",
            titulo: "Acréscimo",
            desc: "Com a reforma, você vai pagar mais nessa operação. Vale analisar no Comparador se outro regime compensa.",
          },
          {
            icon: "💳",
            titulo: "Crédito de entrada",
            desc: "Percentual do imposto que você recupera sobre o que compra para vender. Simples Nacional e MEI não geram crédito, pois o imposto já está embutido no DAS.",
          },
          {
            icon: "📅",
            titulo: "Alíquotas provisórias",
            desc: "Os valores de 2027 em diante ainda são estimativas, pois a lei define as alíquotas definitivas ao longo da transição. O simulador avisa quando usar projeções.",
          },
        ].map((item) => (
          <div key={item.titulo} className="flex items-start gap-3 rounded-xl border border-ink-100 px-4 py-3.5">
            <span className="text-[20px] mt-0.5 shrink-0">{item.icon}</span>
            <div>
              <div className="font-semibold text-[14px] text-ink-900">{item.titulo}</div>
              <div className="text-[12.5px] text-ink-500 mt-0.5 leading-snug">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-ink-50 border border-ink-150 px-4 py-3 text-[12.5px] text-ink-600 leading-snug">
        📌 Os valores são calculados sobre <strong>uma operação</strong> (ex: R$ 100.000 de faturamento mensal).
        Para estimar o impacto anual, multiplique pelo seu volume de operações.
      </div>
    </div>
  );
}

/* ── Tela 5: Wizard de configuração (3 sub-passos) ── */
interface WizardConfigProps {
  wizStep: WizStep;
  setWizStep: (s: WizStep) => void;
  porte: string;
  setPorte: (s: string) => void;
  atividade: string;
  setAtividade: (s: string) => void;
  concluir: (obj: (typeof OBJETIVOS)[number]) => void;
}

function WizardConfig({ wizStep, setWizStep, porte, setPorte, atividade, setAtividade, concluir }: WizardConfigProps) {
  return (
    <div>
      {wizStep === 1 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">Configure · Passo 1 de 3</div>
          <h3 className="font-display text-[20px] font-bold text-ink-900 leading-tight mb-5">Qual o porte da empresa?</h3>
          <div className="space-y-2.5">
            {PORTES.map((p) => (
              <button
                key={p.id}
                onClick={() => { setPorte(p.id); setWizStep(2); }}
                className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3.5 transition
                  ${porte === p.id ? "border-brand-400 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/50"}`}
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-ink-100 flex items-center justify-center text-[20px] shrink-0">{p.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-[14px] text-ink-900">{p.titulo}</div>
                  <div className="text-[12px] text-ink-500 mt-0.5">{p.desc}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-300 shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {wizStep === 2 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">Configure · Passo 2 de 3</div>
          <h3 className="font-display text-[20px] font-bold text-ink-900 leading-tight mb-5">O que sua empresa faz?</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {ATIVIDADES.map((a) => (
              <button
                key={a.id}
                onClick={() => { setAtividade(a.id); setWizStep(3); }}
                className={`text-left rounded-xl border p-4 transition
                  ${atividade === a.id ? "border-brand-400 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/50"}`}
              >
                <div className="text-[24px] mb-2">{a.icon}</div>
                <div className="font-semibold text-[14px] text-ink-900">{a.titulo}</div>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <button
              onClick={() => setWizStep(1)}
              className="text-[12.5px] text-ink-500 hover:text-ink-900 font-medium inline-flex items-center gap-1 transition"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Voltar
            </button>
          </div>
        </div>
      )}

      {wizStep === 3 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">Configure · Passo 3 de 3</div>
          <h3 className="font-display text-[20px] font-bold text-ink-900 leading-tight mb-5">O que quer descobrir?</h3>
          <div className="space-y-2.5">
            {OBJETIVOS.map((o) => (
              <button
                key={o.id}
                onClick={() => concluir(o)}
                className="w-full text-left rounded-xl border border-ink-200 hover:border-brand-400 hover:bg-brand-50/50 px-4 py-3.5 transition group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[14px] text-ink-900">{o.titulo}</div>
                    <div className="text-[12px] text-ink-500 mt-0.5">{o.desc}</div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-brand-400 text-brand-800 flex items-center justify-center transform group-hover:translate-x-1 transition shrink-0 ml-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <button
              onClick={() => setWizStep(2)}
              className="text-[12.5px] text-ink-500 hover:text-ink-900 font-medium inline-flex items-center gap-1 transition"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
