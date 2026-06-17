"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function TrocarSenhaPage() {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não conferem.");
      return;
    }

    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: senha,
      data: { senha_trocada: true },
    });
    if (error) {
      setErro("Não foi possível trocar a senha: " + error.message);
      setCarregando(false);
      return;
    }
    // Recarrega no início; o proxy deixa de exigir a troca.
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
            Defina sua senha
          </h1>
          <p className="text-[13px] text-ink-500 mt-1 mb-6">
            Crie uma senha pessoal para continuar.
          </p>

          <form onSubmit={salvar} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">
                Nova senha <span className="font-normal text-ink-400">(mín. 8 caracteres)</span>
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">Confirmar nova senha</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
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
              {carregando ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11.5px] text-brand-300 mt-5">
          <a href="/" className="hover:text-white underline-offset-2 hover:underline">
            Voltar ao sistema
          </a>
        </p>
      </div>
    </div>
  );
}
