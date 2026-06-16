"use client";

/* Shared transition cronograma + Timeline picker
 * Used by Simulador, Markup and Comparador
 */
export interface CronogramaItem {
  ano: number;
  fase: string;
  curto: string;
  desc: string;
}

export const CRONOGRAMA: CronogramaItem[] = [
  { ano: 2026, fase: "Testes",    curto: "Fase de testes",          desc: "Alíquotas-teste: CBS 0,9% e IBS 0,1%. Você ainda paga PIS/COFINS/ICMS/ISS normalmente — use o ano para se preparar." },
  { ano: 2027, fase: "CBS plena", curto: "CBS entra em vigor",      desc: "PIS e COFINS extintos. CBS em alíquota plena. Imposto Seletivo começa." },
  { ano: 2028, fase: "Ajuste CBS",curto: "Ajuste fino da CBS",      desc: "CBS estabilizada. ICMS e ISS ainda em vigor. Última janela para revisar regime tributário antes do IBS." },
  { ano: 2029, fase: "IBS 10%",   curto: "IBS começa",              desc: "IBS começa a substituir ICMS/ISS. 10% do IBS implementado; ICMS/ISS reduzidos em 10%." },
  { ano: 2030, fase: "IBS 20%",   curto: "Transição IBS",           desc: "IBS em 20% da alíquota plena. ICMS/ISS em 80%." },
  { ano: 2031, fase: "IBS 30%",   curto: "Transição IBS",           desc: "IBS em 30% da alíquota plena. ICMS/ISS em 70%." },
  { ano: 2032, fase: "IBS 40%",   curto: "Último ano duplo",        desc: "IBS em 40% da alíquota plena. ICMS/ISS em 60%. Último ano de coexistência." },
  { ano: 2033, fase: "Pleno",     curto: "Sistema novo pleno",      desc: "ICMS e ISS extintos. Apenas IBS + CBS. IVA Dual em pleno funcionamento." },
];

export default function TransitionTimeline({
  ano, setAno,
}: { ano: number; setAno: (n: number) => void }) {
  const fase = CRONOGRAMA.find((c) => c.ano === ano) ?? CRONOGRAMA[0];
  const progress = ((ano - 2026) / 7) * 100;

  return (
    <div className="rounded-2xl bg-white hairline overflow-hidden">
      <div className="px-6 lg:px-7 pt-6 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-0.5">
            Cronograma da transição
          </div>
          <h3 className="font-display text-[17px] font-bold text-ink-900 leading-tight">{fase.curto}</h3>
          <p className="text-[12.5px] text-ink-500 mt-1 leading-relaxed max-w-2xl">{fase.desc}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAno(Math.max(2026, ano - 1))}
            disabled={ano === 2026}
            className="w-8 h-8 rounded-lg hairline-strong text-ink-500 hover:text-ink-900 disabled:opacity-30 transition flex items-center justify-center"
            aria-label="Ano anterior"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => setAno(Math.min(2033, ano + 1))}
            disabled={ano === 2033}
            className="w-8 h-8 rounded-lg hairline-strong text-ink-500 hover:text-ink-900 disabled:opacity-30 transition flex items-center justify-center"
            aria-label="Próximo ano"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline track */}
      <div className="px-6 lg:px-7 pb-7 pt-2 relative">
        <div className="absolute left-7 right-7 top-[34px] h-px bg-ink-100" />
        <div
          className="absolute left-7 right-7 top-[34px] h-px transition-all"
          style={{
            background: `linear-gradient(90deg, #01D1FF 0%, #01D1FF ${progress}%, transparent ${progress}%)`,
          }}
        />
        <div className="grid grid-cols-8 gap-1">
          {CRONOGRAMA.map((c) => {
            const active = c.ano === ano;
            const past = c.ano < ano;
            return (
              <button
                key={c.ano}
                onClick={() => setAno(c.ano)}
                className="group flex flex-col items-center pt-2 pb-1 relative"
              >
                <span
                  className={`relative z-10 w-[14px] h-[14px] rounded-full transition-all
                    ${active ? "bg-brand-400 ring-4 ring-brand-400/20 scale-110" :
                      past   ? "bg-brand-300" :
                               "bg-white border-2 border-ink-200 group-hover:border-brand-400"}`}
                />
                <span
                  className={`mt-2.5 text-[11px] tab-num font-semibold transition-colors
                    ${active ? "text-brand-700" : past ? "text-brand-600" : "text-ink-500 group-hover:text-ink-700"}`}
                >
                  {c.ano}
                </span>
                <span
                  className={`text-[10px] leading-tight mt-0.5 font-medium transition-colors
                    ${active ? "text-ink-700" : "text-ink-400"}`}
                >
                  {c.fase}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
