"use client";

import type { RecomendacaoItem } from "./types";

interface Props {
  recomendacoes: RecomendacaoItem[];
}

const corCard: Record<string, string> = {
  alta: "bg-amber-50 border-amber-200",
  media: "bg-brand-50 border-brand-200",
  baixa: "bg-slate-50 border-slate-200",
};

export default function Recomendacoes({ recomendacoes }: Props) {
  if (!recomendacoes?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-800 mb-1">O que fazer agora?</h3>
      <p className="text-xs text-slate-500 mb-3">
        Ações recomendadas com base nos resultados da sua simulação.
      </p>
      <div className="space-y-3">
        {recomendacoes.map((rec, i) => (
          <div
            key={i}
            className={`flex gap-3 rounded-lg p-3 border ${corCard[rec.prioridade] ?? corCard.baixa}`}
          >
            <span className="text-xl leading-none mt-0.5 select-none">{rec.icone}</span>
            <div>
              <div className="font-medium text-sm text-slate-800">{rec.titulo}</div>
              <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{rec.texto}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
        ⚠️ <strong>Simulação informativa.</strong> Consulte seu contador antes de tomar decisões
        estratégicas de regime tributário, precificação ou planejamento de capital de giro.
      </div>
    </div>
  );
}
