"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthProvider";

export type Aba = "simulador" | "markup" | "comparador" | "base_legal" | "calculadora_dl" | "split_payment" | "simples_nacional" | "ncm_cst" | "nfe_credito" | "contador";

interface Props {
  aba: Aba;
  setAba: (a: Aba) => void;
  onAbrirOnboarding?: () => void;
}

const TAB_MODULO: Partial<Record<Aba, string>> = {
  simulador:     "tributos",
  markup:        "markup",
  comparador:    "comparador",
  split_payment: "split_payment",
  contador:      "contador",
};

const FERRAMENTAS_ABAS: { id: Aba; label: string }[] = [
  { id: "calculadora_dl",  label: "Calculadora Retenção Dividendos" },
  { id: "ncm_cst",         label: "NCM / CST" },
  { id: "nfe_credito",     label: "NF-e / Crédito" },
];

function IconCadeado() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function TooltipCadeado({ visivel }: { visivel: boolean }) {
  if (!visivel) return null;
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 pointer-events-none">
      <div className="bg-ink-900 text-white text-[11.5px] rounded-xl px-3.5 py-2.5 shadow-xl text-center whitespace-nowrap leading-snug">
        <div className="font-semibold mb-0.5">Disponível no perfil Completo</div>
        <div className="text-ink-400 text-[11px]">Fale com o administrador para liberar</div>
      </div>
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-ink-900" />
    </div>
  );
}

function TooltipHover({ texto, subtexto }: { texto: string; subtexto?: string }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      <div className="bg-ink-900 text-white text-[11.5px] rounded-xl px-3.5 py-2.5 shadow-xl text-center whitespace-nowrap leading-snug">
        <div className="font-semibold mb-0.5">{texto}</div>
        {subtexto && <div className="text-ink-400 text-[11px]">{subtexto}</div>}
      </div>
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-ink-900" />
    </div>
  );
}

export default function Header({ aba, setAba, onAbrirOnboarding }: Props) {
  const { papel, modulos, sair } = useAuth();
  const [cadeadoAtivo, setCadeadoAtivo] = useState<string | null>(null);
  const [ferramentasAberto, setFerramentasAberto] = useState(false);
  const [userMenuAberto, setUserMenuAberto] = useState(false);
  const ferramentasRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fecharDropdowns(e: MouseEvent) {
      if (ferramentasRef.current && !ferramentasRef.current.contains(e.target as Node)) {
        setFerramentasAberto(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", fecharDropdowns);
    return () => document.removeEventListener("mousedown", fecharDropdowns);
  }, []);

  function clicarAba(id: Aba, modulo: string) {
    if (modulos.includes(modulo)) {
      setAba(id);
    } else {
      setCadeadoAtivo(id);
      setTimeout(() => setCadeadoAtivo((prev) => (prev === id ? null : prev)), 3000);
    }
  }

  const isFerramentasAtiva = FERRAMENTAS_ABAS.some((f) => f.id === aba);
  const isSimuladorArea = !isFerramentasAtiva && aba !== "base_legal" && aba !== "split_payment" && aba !== "simples_nacional";

  return (
    <header className="mesh-navy">
      <div className="max-w-[1320px] mx-auto px-4 lg:px-6">
        {/* Top row */}
        <div className="flex items-center justify-between gap-4 pt-5 pb-4 border-b border-white/[0.06]">
          {/* Brand */}
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

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setAba("simulador")}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition ${
                isSimuladorArea ? "text-white" : "text-ink-300 hover:text-white"
              }`}
            >
              Simulador
              {isSimuladorArea && <span className="block h-0.5 mt-1 mx-3 rounded-full bg-brand-400" />}
            </button>

            <button
              onClick={() => setAba("base_legal")}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition ${
                aba === "base_legal" ? "text-white" : "text-ink-300 hover:text-white"
              }`}
            >
              Base legal
              {aba === "base_legal" && <span className="block h-0.5 mt-1 mx-3 rounded-full bg-brand-400" />}
            </button>

            <button
              onClick={() => setAba("simples_nacional")}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition ${
                aba === "simples_nacional" ? "text-white" : "text-ink-300 hover:text-white"
              }`}
            >
              Simples Nacional
              {aba === "simples_nacional" && <span className="block h-0.5 mt-1 mx-3 rounded-full bg-brand-400" />}
            </button>

            {modulos.includes("contador") && (
              <button
                onClick={() => setAba("contador")}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition ${
                  aba === "contador" ? "text-white" : "text-ink-300 hover:text-white"
                }`}
              >
                Contador
                {aba === "contador" && <span className="block h-0.5 mt-1 mx-3 rounded-full bg-brand-400" />}
              </button>
            )}

            {/* Ferramentas dropdown */}
            <div className="relative" ref={ferramentasRef}>
              <button
                onClick={() => setFerramentasAberto((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition ${
                  isFerramentasAtiva || ferramentasAberto ? "text-white" : "text-ink-300 hover:text-white"
                }`}
              >
                Ferramentas
                <IconChevron open={ferramentasAberto} />
                {isFerramentasAtiva && !ferramentasAberto && (
                  <span className="block h-0.5 mt-1 rounded-full bg-brand-400" />
                )}
              </button>
              {isFerramentasAtiva && !ferramentasAberto && (
                <span className="block h-0.5 mx-3 rounded-full bg-brand-400" />
              )}

              {ferramentasAberto && (
                <div className="absolute top-full left-0 mt-1.5 z-50 bg-ink-900 border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[220px]">
                  {FERRAMENTAS_ABAS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setAba(item.id); setFerramentasAberto(false); }}
                      className={`w-full text-left px-4 py-2 text-[13px] font-medium transition rounded-lg mx-0 ${
                        aba === item.id
                          ? "text-white bg-white/[0.08]"
                          : "text-ink-300 hover:text-white hover:bg-white/[0.05]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Split Payment — bloqueado */}
            <div className="relative group">
              <button
                disabled
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-ink-500 cursor-not-allowed opacity-60"
              >
                <IconCadeado />
                Split Payment
              </button>
              <TooltipHover
                texto="Aguardando regulamentação"
                subtexto="A Receita Federal ainda não publicou as regras"
              />
            </div>
          </nav>

          {/* Ações direita */}
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

            {/* Menu de usuário */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuAberto((v) => !v)}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-[12px] font-medium border transition ${
                  userMenuAberto
                    ? "bg-white/10 border-brand-400/60 text-white"
                    : "border-white/10 hover:border-brand-400/60 text-brand-300 hover:text-white"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </button>

              {userMenuAberto && (
                <div className="absolute top-full right-0 mt-1.5 z-50 bg-ink-900 border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[170px]">
                  {papel === "master" && (
                    <a
                      href="/admin"
                      onClick={() => setUserMenuAberto(false)}
                      className="flex items-center gap-2.5 w-full px-4 py-2 text-[13px] font-medium text-ink-300 hover:text-white hover:bg-white/[0.05] transition rounded-lg"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Admin
                    </a>
                  )}
                  <a
                    href="/trocar-senha"
                    onClick={() => setUserMenuAberto(false)}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-[13px] font-medium text-ink-300 hover:text-white hover:bg-white/[0.05] transition rounded-lg"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Trocar senha
                  </a>
                  <div className="my-1 border-t border-white/[0.08]" />
                  <button
                    onClick={() => { setUserMenuAberto(false); sair(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-[13px] font-medium text-red-400 hover:text-red-300 hover:bg-white/[0.05] transition rounded-lg"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                    </svg>
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Title row + tab pills — só nas abas do simulador */}
        {isSimuladorArea && (
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
                  { id: "simulador",  label: "Tributos",   modulo: "tributos"   },
                  { id: "markup",     label: "Markup",     modulo: "markup"     },
                  { id: "comparador", label: "Comparador", modulo: "comparador" },
                ] as { id: Aba; label: string; modulo: string }[]).map((a) => {
                  const bloqueada = !modulos.includes(a.modulo);
                  return (
                    <div key={a.id} className="relative">
                      <button
                        onClick={() => clicarAba(a.id, a.modulo)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-lg transition-all ${
                          bloqueada
                            ? "text-white/30 cursor-default"
                            : aba === a.id
                              ? "bg-white text-brand-800 shadow-[0_2px_8px_rgba(0,0,0,.25)]"
                              : "text-brand-200 hover:text-white"
                        }`}
                      >
                        {bloqueada && <IconCadeado />}
                        {a.label}
                      </button>
                      <TooltipCadeado visivel={cadeadoAtivo === a.id} />
                    </div>
                  );
                })}
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
