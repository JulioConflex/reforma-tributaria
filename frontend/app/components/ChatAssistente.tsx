"use client";

import { useState, useRef, useEffect } from "react";
import { API } from "./types";

interface Msg {
  role: "user" | "bot";
  texto: string;
  fontes?: string[];
}

const SUGESTOES = [
  "O que é o IBS?",
  "Quando a reforma entra em vigor?",
  "Qual a alíquota do novo sistema?",
  "Meu setor tem redução?",
  "O que é Split Payment?",
];

/* Formata **negrito**, _itálico_ e quebras de linha do texto do bot. */
function Formatado({ texto }: { texto: string }) {
  const linhas = texto.split("\n").filter((l) => l.trim().length > 0);
  return (
    <>
      {linhas.map((linha, li) => {
        const italico = linha.startsWith("_") && linha.endsWith("_");
        const limpa = italico ? linha.slice(1, -1) : linha;
        const partes = limpa.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={li} className={italico ? "text-[11px] text-ink-400 italic mt-1.5" : "mb-1.5 last:mb-0"}>
            {partes.map((p, i) =>
              p.startsWith("**") && p.endsWith("**")
                ? <strong key={i} className="font-semibold text-ink-900">{p.slice(2, -2)}</strong>
                : <span key={i}>{p}</span>
            )}
          </p>
        );
      })}
    </>
  );
}

export default function ChatAssistente() {
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [carregando, setCarregando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, carregando, aberto]);

  const enviar = async (texto: string) => {
    const q = texto.trim();
    if (!q || carregando) return;
    setMsgs((m) => [...m, { role: "user", texto: q }]);
    setPergunta("");
    setCarregando(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: q }),
      });
      const d = await res.json();
      setMsgs((m) => [...m, { role: "bot", texto: d.resposta ?? "Não consegui responder.", fontes: d.fontes }]);
    } catch {
      setMsgs((m) => [...m, { role: "bot", texto: "Não consegui responder agora — verifique se o servidor está no ar." }]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? "Fechar assistente" : "Abrir assistente da reforma"}
        className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full bg-brand-400 text-brand-800 shadow-[0_8px_24px_rgba(1,22,47,.35)] hover:bg-brand-300 transition flex items-center justify-center"
      >
        {aberto ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
        )}
      </button>

      {/* Painel */}
      {aberto && (
        <div className="fixed bottom-24 right-5 z-[60] w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-7.5rem))] rounded-2xl bg-white shadow-2xl border border-ink-200 flex flex-col overflow-hidden anim-in">
          {/* Cabeçalho */}
          <div className="mesh-navy text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-brand-400/20 border border-brand-400/30 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#56DEFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
              </span>
              <div>
                <div className="font-display font-bold text-[14px] leading-tight">Assistente da Reforma</div>
                <div className="text-[11px] text-brand-300">Dúvidas sobre a LC 214/2025</div>
              </div>
            </div>
            <button onClick={() => setAberto(false)} aria-label="Fechar" className="text-brand-200 hover:text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-ink-50">
            {msgs.length === 0 && (
              <div className="text-[12.5px] text-ink-500 bg-white rounded-xl rounded-tl-sm border border-ink-100 px-3.5 py-2.5">
                Olá! 👋 Posso explicar IBS, CBS, Imposto Seletivo, cronograma, reduções por setor, Simples/MEI e mais. Pergunte ou toque numa sugestão:
              </div>
            )}

            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] bg-brand-400 text-brand-800 rounded-2xl rounded-br-sm px-3.5 py-2 text-[13px] font-medium">
                    {m.texto}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[88%] bg-white border border-ink-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13px] text-ink-700 leading-relaxed">
                    <Formatado texto={m.texto} />
                    {m.fontes && m.fontes.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-ink-100 text-[10.5px] text-ink-400">
                        <span className="font-semibold">Base:</span> {m.fontes.join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {carregando && (
              <div className="flex justify-start">
                <div className="bg-white border border-ink-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[12px] text-ink-400">
                  digitando…
                </div>
              </div>
            )}

            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="text-[11.5px] px-2.5 py-1 rounded-full bg-white border border-ink-200 text-ink-600 hover:border-brand-400 hover:text-brand-700 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={fimRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); enviar(pergunta); }}
            className="p-2.5 border-t border-ink-100 flex gap-2 shrink-0 bg-white"
          >
            <input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Digite sua pergunta…"
              maxLength={500}
              className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-[13px] text-ink-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
            />
            <button
              type="submit"
              disabled={carregando || !pergunta.trim()}
              aria-label="Enviar"
              className="w-10 h-10 shrink-0 rounded-lg bg-brand-400 text-brand-800 hover:bg-brand-300 disabled:opacity-40 transition flex items-center justify-center"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </form>

          <div className="px-3 pb-2 text-[10px] text-ink-400 bg-white text-center shrink-0">
            Respostas informativas — confirme com seu contador.
          </div>
        </div>
      )}
    </>
  );
}
