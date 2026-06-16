"use client";

import { useState, useRef, useCallback } from "react";
import { API } from "./types";

interface TermoData {
  nome_completo: string;
  resumo: string;
  analogia: string;
  impacto?: string;
}

const _cache: Record<string, TermoData> = {};

interface Props {
  termo: string;
  children: React.ReactNode;
  className?: string;
}

export default function TooltipGlossario({ termo, children, className = "" }: Props) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<TermoData | null>(null);
  const [carregando, setCarregando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = useCallback(async () => {
    if (_cache[termo]) { setDados(_cache[termo]); return; }
    setCarregando(true);
    try {
      const res = await fetch(`${API}/api/glossario/${termo}`);
      if (res.ok) { const d = await res.json(); _cache[termo] = d; setDados(d); }
    } finally { setCarregando(false); }
  }, [termo]);

  const abrir = () => {
    timerRef.current = setTimeout(() => { setAberto(true); buscar(); }, 250);
  };
  const fechar = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAberto(false);
  };
  const toggle = () => { if (aberto) fechar(); else { setAberto(true); buscar(); } };

  return (
    <span className="relative inline-block">
      <span
        className={`cursor-help border-b border-dashed border-brand-400 text-brand-600 hover:text-brand-800 transition-colors ${className}`}
        onMouseEnter={abrir}
        onMouseLeave={fechar}
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && toggle()}
        aria-haspopup="true"
        aria-expanded={aberto}
      >
        {children}
      </span>

      {aberto && (
        <div
          className="absolute z-50 left-0 top-full mt-1.5 w-80 rounded-xl shadow-xl border border-slate-200 bg-white p-4 text-sm"
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); setAberto(true); }}
          onMouseLeave={fechar}
        >
          {carregando ? (
            <div className="text-slate-400 text-xs py-2">Carregando...</div>
          ) : dados ? (
            <div className="space-y-2">
              <div className="font-semibold text-slate-800 text-sm">{dados.nome_completo}</div>
              <div className="text-slate-600 text-xs leading-relaxed">{dados.resumo}</div>
              <div className="rounded-lg bg-brand-50 border border-brand-100 p-2.5 text-xs text-brand-800 leading-relaxed">
                <span className="font-medium">Na prática: </span>{dados.analogia}
              </div>
              {dados.impacto && (
                <div className="text-xs text-slate-500 leading-relaxed border-t pt-2">{dados.impacto}</div>
              )}
            </div>
          ) : (
            <div className="text-slate-400 text-xs py-2">Termo não encontrado.</div>
          )}
          <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white border-l border-t border-slate-200 rotate-45" />
        </div>
      )}
    </span>
  );
}
