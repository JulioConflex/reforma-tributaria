"use client";

import { useCallback, useEffect, useState } from "react";

interface Usuario {
  id: string;
  email: string;
  nome: string | null;
  papel: "normal" | "master";
  criado_em: string;
}

export default function AdminPanel({ meId, meEmail }: { meId: string; meEmail: string }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Form de criação
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<"normal" | "master">("normal");
  const [criando, setCriando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [senhaTemp, setSenhaTemp] = useState<{ email: string; senha: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/admin/usuarios");
      const d = await res.json();
      if (!res.ok) throw new Error(d.erro || "Falha ao carregar usuários");
      setUsuarios(d.usuarios ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErro(null);
    setCriando(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, papel }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.erro || "Falha ao criar usuário");
      setMsg(`Usuário ${email} criado com sucesso.`);
      setNome("");
      setEmail("");
      setSenha("");
      setPapel("normal");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCriando(false);
    }
  }

  async function alterarPapel(u: Usuario) {
    const novo = u.papel === "master" ? "normal" : "master";
    const acao = novo === "master" ? "promover a master" : "rebaixar para normal";
    if (!confirm(`Deseja ${acao} o usuário ${u.email}?`)) return;
    setErro(null);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, papel: novo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.erro || "Falha ao alterar papel");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    }
  }

  async function resetarSenha(u: Usuario) {
    if (!confirm(`Gerar uma nova senha temporária para ${u.email}? A senha atual deixará de funcionar.`)) return;
    setErro(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.erro || "Falha ao resetar a senha");
      setSenhaTemp({ email: u.email, senha: d.senha });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    }
  }

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Top bar */}
      <header className="mesh-navy">
        <div className="max-w-[1100px] mx-auto px-4 lg:px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-brand-300 font-semibold">
              Administração
            </div>
            <h1 className="font-display text-white text-[20px] font-bold leading-tight">
              Usuários do sistema
            </h1>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-200 hover:text-white border border-white/10 hover:border-brand-400/60 rounded-lg px-3 py-1.5 transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Voltar ao simulador
          </a>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-4 lg:px-6 py-8 grid lg:grid-cols-[380px_1fr] gap-6">
        {/* Criar usuário */}
        <section className="rounded-2xl bg-white hairline-strong p-6 self-start lg:sticky lg:top-6">
          <h2 className="font-display text-[17px] font-bold text-ink-900">Criar novo usuário</h2>
          <p className="text-[12.5px] text-ink-500 mt-1 mb-5 leading-snug">
            O usuário entra direto com este e-mail e senha. Só masters podem criar.
          </p>

          <form onSubmit={criarUsuario} className="space-y-3.5">
            <div>
              <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition"
                placeholder="Nome do usuário"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition"
                placeholder="pessoa@conflex.com.br"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">
                Senha <span className="font-normal text-ink-400">(mín. 8 caracteres)</span>
              </label>
              <input
                type="text"
                required
                minLength={8}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition"
                placeholder="Senha inicial"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">Tipo de acesso</label>
              <select
                value={papel}
                onChange={(e) => setPapel(e.target.value as "normal" | "master")}
                className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition bg-white"
              >
                <option value="normal">Normal (usa o sistema)</option>
                <option value="master">Master (também gerencia usuários)</option>
              </select>
            </div>

            {msg && (
              <div className="rounded-lg bg-brand-50 border border-brand-100 px-3.5 py-2.5 text-[12.5px] text-brand-700">
                {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={criando}
              className="w-full inline-flex items-center justify-center gap-2 text-[14px] font-semibold text-brand-800 bg-brand-400 hover:bg-brand-300 disabled:opacity-60 rounded-lg px-4 py-2.5 transition"
            >
              {criando ? "Criando…" : "Criar usuário"}
            </button>
          </form>
        </section>

        {/* Lista de usuários */}
        <section className="rounded-2xl bg-white hairline-strong overflow-hidden self-start">
          {senhaTemp && (
            <div className="m-4 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3">
              <div className="text-[12.5px] text-ink-700">
                Senha temporária de <span className="font-semibold">{senhaTemp.email}</span>:
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="text-[15px] font-bold text-brand-800 bg-white border border-brand-200 rounded px-2.5 py-1 tracking-wide select-all">
                  {senhaTemp.senha}
                </code>
                <button
                  onClick={() => navigator.clipboard?.writeText(senhaTemp.senha)}
                  className="text-[12px] font-medium text-brand-600 hover:text-brand-700"
                >
                  Copiar
                </button>
                <button
                  onClick={() => setSenhaTemp(null)}
                  className="text-[12px] font-medium text-ink-400 hover:text-ink-700 ml-auto"
                >
                  Fechar
                </button>
              </div>
              <p className="text-[11.5px] text-ink-500 mt-2 leading-snug">
                Envie esta senha ao usuário. No próximo acesso ele será levado a definir a senha própria.
              </p>
            </div>
          )}
          <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
            <h2 className="font-display text-[17px] font-bold text-ink-900">
              Usuários{" "}
              <span className="text-ink-400 font-medium text-[14px]">({usuarios.length})</span>
            </h2>
            <button
              onClick={carregar}
              className="text-[12px] font-medium text-brand-600 hover:text-brand-700"
            >
              Atualizar
            </button>
          </div>

          {erro && (
            <div className="m-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-[12.5px] text-red-700">
              {erro}
            </div>
          )}

          {carregando ? (
            <div className="px-6 py-12 text-center text-[13px] text-ink-400">Carregando…</div>
          ) : usuarios.length === 0 ? (
            <div className="px-6 py-12 text-center text-[13px] text-ink-400">Nenhum usuário ainda.</div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {usuarios.map((u) => {
                const souEu = u.id === meId;
                return (
                  <li key={u.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-ink-900 truncate">
                        {u.nome || u.email}
                        {souEu && <span className="ml-2 text-[11px] font-medium text-ink-400">(você)</span>}
                      </div>
                      <div className="text-[12px] text-ink-500 truncate">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                          u.papel === "master"
                            ? "bg-brand-100 text-brand-700"
                            : "bg-ink-100 text-ink-500"
                        }`}
                      >
                        {u.papel === "master" ? "Master" : "Normal"}
                      </span>
                      <button
                        onClick={() => alterarPapel(u)}
                        disabled={souEu}
                        title={souEu ? "Você não pode alterar o próprio acesso" : ""}
                        className="text-[12px] font-medium text-brand-600 hover:text-brand-700 disabled:text-ink-300 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {u.papel === "master" ? "Tornar normal" : "Tornar master"}
                      </button>
                      <button
                        onClick={() => resetarSenha(u)}
                        disabled={souEu}
                        title={souEu ? "Use 'Trocar senha' no topo para a sua própria conta" : ""}
                        className="text-[12px] font-medium text-ink-500 hover:text-brand-700 disabled:text-ink-300 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        Resetar senha
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="px-6 py-3 border-t border-ink-100 text-[11.5px] text-ink-400 leading-snug">
            Logado como <span className="font-medium text-ink-600">{meEmail}</span>. Para redefinir a
            senha de alguém, use o painel do Supabase (Authentication → Users).
          </div>
        </section>
      </main>
    </div>
  );
}
