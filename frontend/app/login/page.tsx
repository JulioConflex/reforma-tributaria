"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      setErro("E-mail ou senha incorretos.");
      setCarregando(false);
      return;
    }
    // Recarrega para o servidor enxergar o cookie de sessão recém-criado.
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen mesh-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Image
            src="/conflex-logo.webp"
            alt="Conflex Contabilidade"
            width={170}
            height={40}
            priority
            className="h-8 w-auto"
          />
        </div>

        <div className="bg-white rounded-2xl hairline-strong p-7 shadow-[0_20px_50px_rgba(1,22,47,.35)]">
          <h1 className="font-display text-[22px] font-bold text-ink-900 leading-tight">
            Acessar o sistema
          </h1>
          <p className="text-[13px] text-ink-500 mt-1 mb-6">
            Simulador da Reforma Tributária · Conflex
          </p>

          <form onSubmit={entrar} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">E-mail</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition"
                placeholder="voce@conflex.com.br"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">Senha</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition"
                placeholder="••••••••"
              />
            </div>

            {erro && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-[12.5px] text-red-700">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full inline-flex items-center justify-center gap-2 text-[14px] font-semibold text-brand-800 bg-brand-400 hover:bg-brand-300 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg px-4 py-2.5 transition"
            >
              {carregando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11.5px] text-brand-300 mt-5 leading-relaxed">
          Acesso restrito. Para obter um login,<br />fale com um administrador.
        </p>
      </div>
    </div>
  );
}
