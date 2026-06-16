"use client";

import { useCallback, useRef, useState } from "react";
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
      const res = await fetch(`${API}/glossario/${termo}`);
      if (res.ok) {
        const d = await res.json();
        _cache[termo] = d;
        setDados(d);
      }
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
        className={`cursor-help border-b border-dotted border-brand-400/60 text-current hover:text-brand-600 transition-colors ${className}`}
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
        <span
          className="absolute z-50 left-0 top-full mt-1.5 w-72 rounded-xl shadow-xl hairline-strong bg-white p-3.5 text-left"
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); setAberto(true); }}
          onMouseLeave={fechar}
        >
          {carregando ? (
            <span className="block text-ink-400 text-xs py-2">Carregando…</span>
          ) : dados ? (
            <>
              <span className="block font-semibold text-ink-900 text-[13px]">{dados.nome_completo}</span>
              <span className="block text-ink-600 text-[12px] mt-1 leading-relaxed">{dados.resumo}</span>
              <span className="block rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] text-brand-700 mt-2 leading-relaxed">
                <span className="font-semibold">Na prática · </span>{dados.analogia}
              </span>
              {dados.impacto && (
                <span className="block text-[11px] text-ink-500 leading-relaxed border-t border-ink-100 pt-2 mt-2">
                  {dados.impacto}
                </span>
              )}
            </>
          ) : (
            <span className="block text-ink-400 text-xs py-2">Termo não encontrado.</span>
          )}
        </span>
      )}
    </span>
  );
}
