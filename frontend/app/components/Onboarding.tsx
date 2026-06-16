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
  { id: "mei",     titulo: "MEI / Autônomo",       desc: "Faturamento até R$ 81 mil/ano",         regime: "mei",              icon: "👤" },
  { id: "pequena", titulo: "Pequena empresa",      desc: "Até R$ 4,8 mi/ano · Simples Nacional",  regime: "simples_nacional", icon: "🏪" },
  { id: "media",   titulo: "Média ou grande",      desc: "Acima de R$ 4,8 mi/ano",                regime: "lucro_presumido",  icon: "🏢" },
];
const ATIVIDADES = [
  { id: "produtos",    titulo: "Vendo produtos",   setor: "comercio_geral",      icon: "📦" },
  { id: "servicos",    titulo: "Presto serviços",  setor: "servicos_ti",         icon: "🛠️" },
  { id: "saude",       titulo: "Saúde / Clínicas", setor: "saude_clinicas",      icon: "⚕️" },
  { id: "alimentacao", titulo: "Alimentação",      setor: "restaurantes_bares",  icon: "🍽️" },
];
const OBJETIVOS = [
  { id: "carga",  titulo: "Quanto vou pagar de imposto?",   desc: "Calcular tributos por operação",                   aba: "simulador"  as const },
  { id: "regime", titulo: "Devo mudar de regime?",          desc: "Comparar Simples, Presumido, Real e MEI",          aba: "comparador" as const },
  { id: "preco",  titulo: "Como ajustar meu preço?",        desc: "Recalcular markup para manter a margem",           aba: "markup"     as const },
];

export default function Onboarding({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [porte, setPorte] = useState("media");
  const [atividade, setAtividade] = useState("produtos");

  const concluir = (obj: (typeof OBJETIVOS)[number]) => {
    const regime = PORTES.find((p) => p.id === porte)?.regime;
    const setorId = ATIVIDADES.find((a) => a.id === atividade)?.setor;
    onComplete({ regime, setorId, aba: obj.aba });
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-800/70 backdrop-blur-sm flex items-center justify-center p-4 anim-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="mesh-navy px-7 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/conflex-logo.webp" alt="Conflex" width={100} height={24} className="h-5 w-auto block" />
              <span className="h-4 w-px bg-white/20" />
              <div>
                <h2 className="font-display text-[18px] font-bold leading-tight">Vamos começar</h2>
                <p className="text-brand-300 text-[11.5px] mt-0.5">3 perguntas para personalizar a simulação</p>
              </div>
            </div>
            <button onClick={onSkip} className="text-[12px] text-brand-300 hover:text-white">Pular</button>
          </div>
          <div className="mt-5 flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= step ? "bg-brand-400" : "bg-white/15"}`} />
            ))}
          </div>
        </div>

        <div className="px-7 py-7">
          {step === 1 && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">Passo 1 de 3</div>
              <h3 className="font-display text-[20px] font-bold text-ink-900 leading-tight mb-5">Qual o porte da empresa?</h3>
              <div className="space-y-2.5">
                {PORTES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setPorte(p.id); setStep(2); }}
                    className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3.5 transition
                      ${porte === p.id ? "border-brand-400 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/50"}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-white border border-ink-100 flex items-center justify-center text-[20px]">{p.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-[14px] text-ink-900">{p.titulo}</div>
                      <div className="text-[12px] text-ink-500 mt-0.5">{p.desc}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-300">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">Passo 2 de 3</div>
              <h3 className="font-display text-[20px] font-bold text-ink-900 leading-tight mb-5">O que sua empresa faz?</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {ATIVIDADES.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setAtividade(a.id); setStep(3); }}
                    className={`text-left rounded-xl border p-4 transition
                      ${atividade === a.id ? "border-brand-400 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/50"}`}
                  >
                    <div className="text-[24px] mb-2">{a.icon}</div>
                    <div className="font-semibold text-[14px] text-ink-900">{a.titulo}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">Passo 3 de 3</div>
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
                      <div className="w-8 h-8 rounded-lg bg-brand-400 text-brand-800 flex items-center justify-center transform group-hover:translate-x-1 transition">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12h14M13 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {step > 1 && (
          <div className="px-7 pb-5 -mt-2">
            <button
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
              className="text-[12.5px] text-ink-500 hover:text-ink-900 font-medium inline-flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
