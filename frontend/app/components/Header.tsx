"use client";

import Image from "next/image";

export type Aba = "simulador" | "markup" | "comparador" | "base_legal" | "calculadora_dl";

interface Props {
  aba: Aba;
  setAba: (a: Aba) => void;
  onAbrirOnboarding?: () => void;
}

export default function Header({ aba, setAba, onAbrirOnboarding }: Props) {
  return (
    <header className="mesh-navy">
      <div className="max-w-[1320px] mx-auto px-4 lg:px-6">
        {/* Top row — brand + actions */}
        <div className="flex items-center justify-between gap-4 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <Image
              src="/conflex-logo.webp"
              alt="Conflex Contabilidade"
              width={150}
              height={36}
              priority
              className="h-7 w-auto block"
            />
            <span className="hidden sm:inline-block h-5 w-px bg-white/15" />
            <span className="hidden sm:inline text-[12.5px] text-brand-300 font-medium">
              Simulador da Reforma Tributária
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setAba("simulador")}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition ${
                aba !== "base_legal" && aba !== "calculadora_dl" ? "text-white" : "text-ink-300 hover:text-white"
              }`}
            >
              Simulador
              {aba !== "base_legal" && aba !== "calculadora_dl" && (
                <span className="block h-0.5 mt-1 mx-3 rounded-full bg-brand-400" />
              )}
            </button>
            <button
              onClick={() => setAba("base_legal")}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition ${
                aba === "base_legal" ? "text-white" : "text-ink-300 hover:text-white"
              }`}
            >
              Base legal
              {aba === "base_legal" && (
                <span className="block h-0.5 mt-1 mx-3 rounded-full bg-brand-400" />
              )}
            </button>
            <button
              onClick={() => setAba("calculadora_dl")}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition ${
                aba === "calculadora_dl" ? "text-white" : "text-ink-300 hover:text-white"
              }`}
            >
              Calculadora Retenção Dividendos
              {aba === "calculadora_dl" && (
                <span className="block h-0.5 mt-1 mx-3 rounded-full bg-brand-400" />
              )}
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={onAbrirOnboarding}
              className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-300 hover:text-white border border-white/10 hover:border-brand-400/60 rounded-lg px-3 py-1.5 transition"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
              </svg>
              Como funciona
            </button>
            <a
              href="https://conflex.com.br"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-800 bg-brand-400 hover:bg-brand-300 rounded-lg px-3.5 py-1.5 transition"
            >
              Falar com contador
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>

        {/* Title row + tabs — exibido só nas telas do Simulador (Base legal e Calculadora têm cabeçalho próprio) */}
        {aba !== "base_legal" && aba !== "calculadora_dl" && (
        <div className="pt-7 pb-7 lg:pt-9 lg:pb-9 grid lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-brand-300 uppercase tracking-[0.12em] mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              LC 214/2025 · Em vigor desde 2026
            </div>
            <h1 className="font-display text-white text-[40px] lg:text-[48px] leading-[1.02] font-bold tracking-tight">
              Quanto sua empresa vai pagar de imposto<br />
              <span className="text-brand-300">a partir da reforma?</span>
            </h1>
            <p className="mt-4 text-ink-200 text-[15px] leading-relaxed max-w-2xl">
              Simule o impacto da LC 214/2025 no seu negócio — IBS, CBS e Imposto Seletivo —
              com cálculo em tempo real e cronograma de transição até 2033.
            </p>
          </div>

          <div className="lg:col-span-5 flex flex-col items-start lg:items-end gap-4">
            <div className="inline-flex p-1 rounded-xl bg-white/[0.06] border border-white/10">
              {([
                { id: "simulador",  label: "Tributos"   },
                { id: "markup",     label: "Markup"     },
                { id: "comparador", label: "Comparador" },
              ] as { id: Aba; label: string }[]).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all
                    ${aba === a.id
                      ? "bg-white text-brand-800 shadow-[0_2px_8px_rgba(0,0,0,.25)]"
                      : "text-brand-200 hover:text-white"}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="text-[11.5px] text-brand-300 font-medium tab-num">
              <span className="text-white font-semibold">8 anos</span> de transição · 2026 → 2033
            </div>
          </div>
        </div>
        )}
      </div>
    </header>
  );
}
