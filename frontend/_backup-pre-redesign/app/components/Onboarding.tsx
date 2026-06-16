"use client";

import { useState, useEffect } from "react";

interface OnboardingConfig {
  regime: string;
  setorId: string;
  aba: "simulador" | "markup" | "comparador";
}

interface Props {
  onComplete: (cfg: OnboardingConfig) => void;
}

type Passo = 1 | 2 | 3;

const OPCOES_PORTE = [
  {
    id: "mei",
    titulo: "Autônomo / MEI",
    desc: "Fatura até R$ 81 mil por ano",
    regime: "mei",
  },
  {
    id: "pequena",
    titulo: "Pequena empresa",
    desc: "Fatura até R$ 4,8 milhões por ano",
    regime: "simples_nacional",
  },
  {
    id: "media",
    titulo: "Empresa média ou grande",
    desc: "Fatura acima de R$ 4,8 milhões por ano",
    regime: "lucro_presumido",
  },
];

const OPCOES_ATIVIDADE = [
  { id: "produtos", titulo: "Vendo produtos", setor: "comercio_geral" },
  { id: "servicos", titulo: "Presto serviços", setor: "servicos_gerais" },
  { id: "saude", titulo: "Saúde / Farmácia", setor: "saude_clinicas" },
  { id: "alimentacao", titulo: "Alimentação", setor: "restaurantes_bares" },
];

const OPCOES_OBJETIVO = [
  {
    id: "carga",
    titulo: "Quanto vou pagar de imposto?",
    aba: "simulador" as const,
  },
  {
    id: "regime",
    titulo: "Devo mudar de regime tributário?",
    aba: "comparador" as const,
  },
  {
    id: "preco",
    titulo: "Como precificar meus produtos/serviços?",
    aba: "markup" as const,
  },
];

export default function Onboarding({ onComplete }: Props) {
  const [visivel, setVisivel] = useState(false);
  const [passo, setPasso] = useState<Passo>(1);
  const [porte, setPorte] = useState("");
  const [atividade, setAtividade] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("onboarding_feito")) {
      setVisivel(true);
    }
  }, []);

  const pular = () => {
    if (typeof window !== "undefined") localStorage.setItem("onboarding_feito", "1");
    setVisivel(false);
    onComplete({ regime: "lucro_presumido", setorId: "comercio_geral", aba: "simulador" });
  };

  const concluir = (objetivo: (typeof OPCOES_OBJETIVO)[0]) => {
    if (typeof window !== "undefined") localStorage.setItem("onboarding_feito", "1");
    const regimeEscolhido =
      OPCOES_PORTE.find((o) => o.id === porte)?.regime ?? "lucro_presumido";
    const setorEscolhido =
      OPCOES_ATIVIDADE.find((o) => o.id === atividade)?.setor ?? "comercio_geral";
    setVisivel(false);
    onComplete({ regime: regimeEscolhido, setorId: setorEscolhido, aba: objetivo.aba });
  };

  if (!visivel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-brand-800 px-6 py-5 text-white">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold">Bem-vindo ao Simulador</h2>
            <button
              onClick={pular}
              className="text-brand-300 hover:text-white text-sm transition-colors"
            >
              Pular
            </button>
          </div>
          <p className="text-brand-200 text-sm">
            Reforma Tributária LC 214/2025 — 3 perguntas rápidas para personalizar sua
            experiência
          </p>
          {/* Progress */}
          <div className="flex gap-1.5 mt-3">
            {([1, 2, 3] as Passo[]).map((n) => (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full transition-all ${
                  n <= passo ? "bg-white" : "bg-brand-400/50"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-5">
          {passo === 1 && (
            <div>
              <p className="font-medium text-slate-800 mb-4">
                Qual o porte da sua empresa?
              </p>
              <div className="space-y-2">
                {OPCOES_PORTE.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => { setPorte(op.id); setPasso(2); }}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all hover:border-brand-400 hover:bg-brand-50 ${
                      porte === op.id
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="font-medium text-slate-800 text-sm">{op.titulo}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{op.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {passo === 2 && (
            <div>
              <p className="font-medium text-slate-800 mb-4">
                O que a sua empresa faz?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {OPCOES_ATIVIDADE.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => { setAtividade(op.id); setPasso(3); }}
                    className={`text-left rounded-xl border px-4 py-3 transition-all hover:border-brand-400 hover:bg-brand-50 ${
                      atividade === op.id
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="font-medium text-slate-800 text-sm">{op.titulo}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {passo === 3 && (
            <div>
              <p className="font-medium text-slate-800 mb-4">
                O que você quer descobrir?
              </p>
              <div className="space-y-2">
                {OPCOES_OBJETIVO.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => concluir(op)}
                    className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 transition-all hover:border-brand-400 hover:bg-brand-50"
                  >
                    <div className="font-medium text-slate-800 text-sm">{op.titulo}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {passo > 1 && (
          <div className="px-6 pb-5">
            <button
              onClick={() => setPasso((p) => (p - 1) as Passo)}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              ← Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
