"use client";

const MENSAGENS: Record<number, { fase: string; texto: string; cor: string }> = {
  2026: {
    fase: "Fase de Testes",
    texto: "Você ainda paga os impostos antigos. Use este ano para simular e se preparar — as mudanças reais começam em 2027.",
    cor: "bg-amber-500",
  },
  2027: {
    fase: "CBS em vigor",
    texto: "PIS e COFINS acabaram. A CBS (novo imposto federal) entrou em vigor em alíquota plena. Verifique se seus preços ainda fazem sentido.",
    cor: "bg-brand-600",
  },
  2028: {
    fase: "Transição CBS/IBS",
    texto: "CBS em vigor pleno. IBS começa em 2029. Momento de revisar regime tributário e capital de giro.",
    cor: "bg-brand-600",
  },
  2029: {
    fase: "IBS 10%",
    texto: "IBS começa a substituir ICMS e ISS (10% implementado). ICMS e ISS reduzidos proporcionalmente.",
    cor: "bg-indigo-600",
  },
  2030: {
    fase: "IBS 25%",
    texto: "IBS chega a 25% da alíquota plena. ICMS e ISS ainda existem com 75% das alíquotas originais.",
    cor: "bg-indigo-600",
  },
  2031: {
    fase: "IBS 50%",
    texto: "Metade da transição concluída. IBS e ICMS/ISS em equilíbrio — cada um com 50% das alíquotas.",
    cor: "bg-indigo-600",
  },
  2032: {
    fase: "IBS 75%",
    texto: "ICMS e ISS quase extintos, restando apenas 25% das alíquotas originais. IBS em 75% da alíquota plena.",
    cor: "bg-indigo-600",
  },
  2033: {
    fase: "Sistema Pleno",
    texto: "Transição concluída. ICMS e ISS extintos. Apenas IBS + CBS em vigor — o IVA Dual em pleno funcionamento.",
    cor: "bg-green-600",
  },
};

export default function BannerContexto() {
  const anoAtual = new Date().getFullYear();
  const info = MENSAGENS[anoAtual] ?? {
    fase: `Transição ${anoAtual}`,
    texto: "A Reforma Tributária está em implantação gradual. Simule o impacto para o seu negócio.",
    cor: "bg-slate-700",
  };

  return (
    <div className={`${info.cor} text-white`}>
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-start sm:items-center gap-2 text-xs sm:text-sm">
        <span className="shrink-0 rounded bg-white/20 px-2 py-0.5 font-semibold text-xs">
          {info.fase}
        </span>
        <span className="leading-snug opacity-95">
          {info.texto}
          {anoAtual >= 2027 && (
            <span className="opacity-70 text-[10px] ml-2">
              *Alíquotas de referência provisórias — sujeitas a aprovação pelo Senado Federal.
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
