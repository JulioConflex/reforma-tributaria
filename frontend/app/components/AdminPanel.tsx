"use client";

import { useCallback, useEffect, useState } from "react";
import { API } from "./types";

// ─── tipos ──────────────────────────────────────────────────────────────────

type PapelUsuario = "basico" | "completo" | "master";
type AbaMain      = "usuarios" | "aliquotas";
type AbaAliq      = "cronograma" | "setores" | "estados";

interface Usuario {
  id: string; email: string; nome: string | null;
  papel: PapelUsuario; criado_em: string;
}

interface Permissao { papel: "basico" | "completo"; modulo: string; permitido: boolean; }

// campos numéricos por categoria
type CronFields = {
  cbs_percentual?: number | null; ibs_percentual?: number | null;
  ibs_fator?: number | null; icms_fator?: number | null; iss_fator?: number | null;
  pis_cofins_ativo?: boolean | null; aliquotas_provisorias?: boolean | null;
};
type SetorFields = { reducao_aliquota?: number | null; is_estimado?: number | null; iss_padrao?: number | null; };
type EstadoRow   = { uf: string; default_value: number; override_value?: number | null; };

// ─── constantes ─────────────────────────────────────────────────────────────

const MODULOS = [
  { id: "tributos",      label: "Tributos" },
  { id: "markup",        label: "Markup" },
  { id: "comparador",   label: "Comparador" },
  { id: "split_payment", label: "Split Payment" },
] as const;

const PAPEL_LABEL: Record<PapelUsuario, string> = { basico: "Básico", completo: "Completo", master: "Master" };
const PAPEL_BADGE: Record<PapelUsuario, string> = {
  basico: "bg-ink-100 text-ink-500", completo: "bg-blue-50 text-blue-700", master: "bg-brand-100 text-brand-700",
};

const CRON_ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

// ─── helpers ─────────────────────────────────────────────────────────────────

const pct = (v?: number | null) => v != null ? (v * 100).toFixed(2) : "";
const parsePct = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n / 100;
};
const parseFator = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
};

async function patchCfg(categoria: string, body: object) {
  const res = await fetch(`/api/admin/configuracoes/${categoria}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) { const d = await res.json(); throw new Error(d.erro || "Falha ao salvar"); }
}
async function deleteCfg(categoria: string, body: object) {
  const res = await fetch(`/api/admin/configuracoes/${categoria}`, {
    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) { const d = await res.json(); throw new Error(d.erro || "Falha ao restaurar"); }
}

// ─── componente ─────────────────────────────────────────────────────────────

export default function AdminPanel({ meId, meEmail }: { meId: string; meEmail: string }) {
  const [mainTab, setMainTab] = useState<AbaMain>("usuarios");
  const [aliqTab, setAliqTab] = useState<AbaAliq>("cronograma");

  // ── usuários/permissões ─────────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState(""); const [email, setEmail] = useState("");
  const [senha, setSenha] = useState(""); const [papel, setPapel] = useState<PapelUsuario>("basico");
  const [criando, setCriando] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const [senhaTemp, setSenhaTemp] = useState<{ email: string; senha: string } | null>(null);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [salvandoPerm, setSalvandoPerm] = useState<string | null>(null);

  // ── alíquotas ───────────────────────────────────────────────────────────
  const [aliqCarregando, setAliqCarregando] = useState(false);
  const [aliqErro, setAliqErro] = useState<string | null>(null);
  const [aliqMsg, setAliqMsg] = useState<string | null>(null);

  // cronograma
  const [cronDefaults, setCronDefaults] = useState<Record<number, Record<string, unknown>>>({});
  const [cronOverrides, setCronOverrides] = useState<Record<number, CronFields>>({});
  const [cronDrafts, setCronDrafts] = useState<Record<number, CronFields>>({});
  const [savingCron, setSavingCron] = useState<number | null>(null);

  // setores
  const [setoresDefault, setSetoresDefault] = useState<Array<{ id: string; nome: string } & SetorFields>>([]);
  const [setoresOverrides, setSetoresOverrides] = useState<Record<string, SetorFields>>({});
  const [setoresDrafts, setSetoresDrafts] = useState<Record<string, SetorFields>>({});
  const [savingSetor, setSavingSetor] = useState<string | null>(null);

  // estados
  const [estadosRows, setEstadosRows] = useState<EstadoRow[]>([]);
  const [estadosDrafts, setEstadosDrafts] = useState<Record<string, string>>({});
  const [savingEstado, setSavingEstado] = useState<string | null>(null);

  // ── carga de usuários ───────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const [resU, resP] = await Promise.all([
        fetch("/api/admin/usuarios"), fetch("/api/admin/permissoes"),
      ]);
      const dU = await resU.json(); const dP = await resP.json();
      if (!resU.ok) throw new Error(dU.erro || "Falha ao carregar usuários");
      if (!resP.ok) throw new Error(dP.erro || "Falha ao carregar permissões");
      setUsuarios(dU.usuarios ?? []); setPermissoes(dP.permissoes ?? []);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro desconhecido"); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // ── carga de alíquotas ──────────────────────────────────────────────────
  const carregarAliq = useCallback(async () => {
    setAliqCarregando(true); setAliqErro(null);
    try {
      const [resCron, resCronOv, resSet, resSetOv, resEst, resEstOv] = await Promise.all([
        fetch(`${API}/cronograma`),
        fetch("/api/admin/configuracoes/cronograma"),
        fetch(`${API}/setores`),
        fetch("/api/admin/configuracoes/setores"),
        fetch(`${API}/estados`),
        fetch("/api/admin/configuracoes/estados"),
      ]);

      // cronograma defaults
      const dc = await resCron.json();
      const anos: Record<number, Record<string, unknown>> = {};
      for (const [k, v] of Object.entries((dc.anos ?? {}) as Record<string, Record<string, unknown>>)) {
        anos[parseInt(k)] = v;
      }
      setCronDefaults(anos);

      // cronograma overrides
      const oc = await resCronOv.json();
      const covMap: Record<number, CronFields> = {};
      for (const row of (oc.overrides ?? []) as Array<{ ano: number } & CronFields>) {
        const { ano, ...rest } = row;
        covMap[ano] = rest;
      }
      setCronOverrides(covMap);

      // init drafts = merged value (override beats default)
      const drafts: Record<number, CronFields> = {};
      for (const ano of CRON_ANOS) {
        drafts[ano] = { ...covMap[ano] };
      }
      setCronDrafts(drafts);

      // setores defaults
      const ds = await resSet.json();
      const sArr = (ds.setores ?? []) as Array<{ id: string; nome: string } & SetorFields>;
      setSetoresDefault(sArr);

      // setores overrides
      const os = await resSetOv.json();
      const sovMap: Record<string, SetorFields> = {};
      for (const row of (os.overrides ?? []) as Array<{ setor_id: string } & SetorFields>) {
        const { setor_id, ...rest } = row;
        sovMap[setor_id] = rest;
      }
      setSetoresOverrides(sovMap);
      const sDrafts: Record<string, SetorFields> = {};
      for (const s of sArr) { sDrafts[s.id] = { ...sovMap[s.id] }; }
      setSetoresDrafts(sDrafts);

      // estados defaults
      const de = await resEst.json();
      const defaultIcms = (de.icms_interno ?? {}) as Record<string, number>;
      const oe = await resEstOv.json();
      const oEstMap: Record<string, number> = {};
      for (const row of (oe.overrides ?? []) as Array<{ uf: string; icms_interno: number }>) {
        oEstMap[row.uf] = row.icms_interno;
      }
      const rows: EstadoRow[] = Object.entries(defaultIcms).sort(([a], [b]) => a.localeCompare(b)).map(([uf, v]) => ({
        uf, default_value: v, override_value: oEstMap[uf] ?? null,
      }));
      setEstadosRows(rows);
      const eDrafts: Record<string, string> = {};
      for (const r of rows) {
        eDrafts[r.uf] = r.override_value != null ? pct(r.override_value) : "";
      }
      setEstadosDrafts(eDrafts);

    } catch (e) {
      setAliqErro(e instanceof Error ? e.message : "Erro ao carregar alíquotas");
    } finally { setAliqCarregando(false); }
  }, []);

  useEffect(() => {
    if (mainTab === "aliquotas") carregarAliq();
  }, [mainTab, carregarAliq]);

  // ── helpers de permissão ────────────────────────────────────────────────
  function getPermitido(p: "basico" | "completo", m: string) {
    return permissoes.find((x) => x.papel === p && x.modulo === m)?.permitido ?? false;
  }

  async function togglePermissao(p: "basico" | "completo", m: string) {
    const atual = getPermitido(p, m); const chave = `${p}:${m}`;
    setSalvandoPerm(chave);
    try {
      const res = await fetch("/api/admin/permissoes", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papel: p, modulo: m, permitido: !atual }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.erro || "Falha ao salvar permissão");
      setPermissoes((prev) => prev.map((x) => x.papel === p && x.modulo === m ? { ...x, permitido: !atual } : x));
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao salvar permissão"); }
    finally { setSalvandoPerm(null); }
  }

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setErro(null); setCriando(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, papel }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.erro || "Falha ao criar usuário");
      setMsg(`Usuário ${email} criado com sucesso.`);
      setNome(""); setEmail(""); setSenha(""); setPapel("basico");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro desconhecido"); }
    finally { setCriando(false); }
  }

  async function alterarPapel(u: Usuario, novoPapel: PapelUsuario) {
    if (novoPapel === u.papel) return;
    if (!confirm(`Deseja mudar ${u.email} para ${PAPEL_LABEL[novoPapel]}?`)) return;
    setErro(null);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, papel: novoPapel }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.erro || "Falha ao alterar papel");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao alterar papel"); }
  }

  async function resetarSenha(u: Usuario) {
    if (!confirm(`Gerar nova senha temporária para ${u.email}? A senha atual deixará de funcionar.`)) return;
    setErro(null); setMsg(null);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.erro || "Falha ao resetar a senha");
      setSenhaTemp({ email: u.email, senha: d.senha });
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao resetar senha"); }
  }

  // ── salvar cronograma ───────────────────────────────────────────────────
  async function salvarCron(ano: number) {
    setSavingCron(ano); setAliqErro(null); setAliqMsg(null);
    try {
      const draft = cronDrafts[ano] ?? {};
      const payload: Record<string, unknown> = { ano };
      const def = cronDefaults[ano] ?? {};
      for (const [k, v] of Object.entries(draft)) {
        if (v !== null && v !== undefined) payload[k] = v;
      }
      if (Object.keys(payload).length <= 1) {
        setAliqMsg(`Nenhuma alteração para salvar no ano ${ano}.`); return;
      }
      await patchCfg("cronograma", payload);
      setAliqMsg(`Ano ${ano} salvo.`);
      // refresh overrides
      const res = await fetch("/api/admin/configuracoes/cronograma");
      const d = await res.json();
      const newOv: Record<number, CronFields> = {};
      for (const row of (d.overrides ?? []) as Array<{ ano: number } & CronFields>) {
        const { ano: a, ...rest } = row; newOv[a] = rest;
      }
      setCronOverrides(newOv);
    } catch (e) { setAliqErro(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSavingCron(null); }
  }

  async function restaurarCron(ano: number) {
    if (!confirm(`Restaurar valores padrão do ano ${ano}?`)) return;
    setSavingCron(ano); setAliqErro(null); setAliqMsg(null);
    try {
      await deleteCfg("cronograma", { ano });
      setAliqMsg(`Ano ${ano} restaurado ao padrão.`);
      setCronOverrides((prev) => { const n = { ...prev }; delete n[ano]; return n; });
      setCronDrafts((prev) => ({ ...prev, [ano]: {} }));
    } catch (e) { setAliqErro(e instanceof Error ? e.message : "Erro ao restaurar"); }
    finally { setSavingCron(null); }
  }

  // ── salvar setor ────────────────────────────────────────────────────────
  async function salvarSetor(setorId: string) {
    setSavingSetor(setorId); setAliqErro(null); setAliqMsg(null);
    try {
      const draft = setoresDrafts[setorId] ?? {};
      const payload: Record<string, unknown> = { setor_id: setorId };
      for (const [k, v] of Object.entries(draft)) {
        if (v !== null && v !== undefined) payload[k] = v;
      }
      if (Object.keys(payload).length <= 1) {
        setAliqMsg("Nenhuma alteração para salvar."); return;
      }
      await patchCfg("setores", payload);
      setAliqMsg(`Setor salvo.`);
      const res = await fetch("/api/admin/configuracoes/setores");
      const d = await res.json();
      const newOv: Record<string, SetorFields> = {};
      for (const row of (d.overrides ?? []) as Array<{ setor_id: string } & SetorFields>) {
        const { setor_id, ...rest } = row; newOv[setor_id] = rest;
      }
      setSetoresOverrides(newOv);
    } catch (e) { setAliqErro(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSavingSetor(null); }
  }

  async function restaurarSetor(setorId: string) {
    if (!confirm("Restaurar valores padrão deste setor?")) return;
    setSavingSetor(setorId); setAliqErro(null); setAliqMsg(null);
    try {
      await deleteCfg("setores", { setor_id: setorId });
      setAliqMsg("Setor restaurado ao padrão.");
      setSetoresOverrides((prev) => { const n = { ...prev }; delete n[setorId]; return n; });
      setSetoresDrafts((prev) => ({ ...prev, [setorId]: {} }));
    } catch (e) { setAliqErro(e instanceof Error ? e.message : "Erro ao restaurar"); }
    finally { setSavingSetor(null); }
  }

  // ── salvar estado ───────────────────────────────────────────────────────
  async function salvarEstado(uf: string) {
    setSavingEstado(uf); setAliqErro(null); setAliqMsg(null);
    try {
      const raw = estadosDrafts[uf] ?? "";
      const v = parsePct(raw);
      if (v === null) { setAliqErro("Valor inválido."); return; }
      await patchCfg("estados", { uf, icms_interno: v });
      setAliqMsg(`ICMS de ${uf} salvo (${(v * 100).toFixed(2)}%).`);
      setEstadosRows((prev) => prev.map((r) => r.uf === uf ? { ...r, override_value: v } : r));
    } catch (e) { setAliqErro(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSavingEstado(null); }
  }

  async function restaurarEstado(uf: string) {
    setSavingEstado(uf); setAliqErro(null); setAliqMsg(null);
    try {
      await deleteCfg("estados", { uf });
      setAliqMsg(`ICMS de ${uf} restaurado ao padrão.`);
      setEstadosRows((prev) => prev.map((r) => r.uf === uf ? { ...r, override_value: null } : r));
      setEstadosDrafts((prev) => ({ ...prev, [uf]: "" }));
    } catch (e) { setAliqErro(e instanceof Error ? e.message : "Erro ao restaurar"); }
    finally { setSavingEstado(null); }
  }

  // ─── render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-ink-50">
      {/* top bar */}
      <header className="mesh-navy">
        <div className="max-w-[1100px] mx-auto px-4 lg:px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-brand-300 font-semibold">Administração</div>
            <h1 className="font-display text-white text-[20px] font-bold leading-tight">Painel master</h1>
          </div>
          <a href="/" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-200 hover:text-white border border-white/10 hover:border-brand-400/60 rounded-lg px-3 py-1.5 transition">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Voltar ao simulador
          </a>
        </div>
      </header>

      {/* tab bar */}
      <div className="max-w-[1100px] mx-auto px-4 lg:px-6 pt-6">
        <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
          {(["usuarios", "aliquotas"] as AbaMain[]).map((t) => (
            <button
              key={t}
              onClick={() => setMainTab(t)}
              className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition ${
                mainTab === t ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {t === "usuarios" ? "Usuários e Permissões" : "Alíquotas"}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-[1100px] mx-auto px-4 lg:px-6 py-6 space-y-6">

        {/* ── aba usuários ──────────────────────────────────────────────── */}
        {mainTab === "usuarios" && (
          <>
            <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
              {/* form criar usuário */}
              <section className="rounded-2xl bg-white hairline-strong p-6 self-start lg:sticky lg:top-6">
                <h2 className="font-display text-[17px] font-bold text-ink-900">Criar novo usuário</h2>
                <p className="text-[12.5px] text-ink-500 mt-1 mb-5 leading-snug">O usuário entra direto com este e-mail e senha.</p>
                <form onSubmit={criarUsuario} className="space-y-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">Nome</label>
                    <input value={nome} onChange={(e) => setNome(e.target.value)}
                      className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition"
                      placeholder="Nome do usuário" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">E-mail</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition"
                      placeholder="pessoa@conflex.com.br" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">Senha <span className="font-normal text-ink-400">(mín. 8 caracteres)</span></label>
                    <input type="text" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)}
                      className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition"
                      placeholder="Senha inicial" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-ink-600 mb-1.5">Perfil</label>
                    <select value={papel} onChange={(e) => setPapel(e.target.value as PapelUsuario)}
                      className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition bg-white">
                      <option value="basico">Básico: somente Tributos</option>
                      <option value="completo">Completo: todos os módulos</option>
                      <option value="master">Master: gerencia usuários e alíquotas</option>
                    </select>
                  </div>
                  {msg && <div className="rounded-lg bg-brand-50 border border-brand-100 px-3.5 py-2.5 text-[12.5px] text-brand-700">{msg}</div>}
                  <button type="submit" disabled={criando}
                    className="w-full inline-flex items-center justify-center gap-2 text-[14px] font-semibold text-brand-800 bg-brand-400 hover:bg-brand-300 disabled:opacity-60 rounded-lg px-4 py-2.5 transition">
                    {criando ? "Criando…" : "Criar usuário"}
                  </button>
                </form>
              </section>

              {/* lista de usuários */}
              <section className="rounded-2xl bg-white hairline-strong overflow-hidden self-start">
                {senhaTemp && (
                  <div className="m-4 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3">
                    <div className="text-[12.5px] text-ink-700">Senha temporária de <span className="font-semibold">{senhaTemp.email}</span>:</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="text-[15px] font-bold text-brand-800 bg-white border border-brand-200 rounded px-2.5 py-1 tracking-wide select-all">{senhaTemp.senha}</code>
                      <button onClick={() => navigator.clipboard?.writeText(senhaTemp.senha)} className="text-[12px] font-medium text-brand-600 hover:text-brand-700">Copiar</button>
                      <button onClick={() => setSenhaTemp(null)} className="text-[12px] font-medium text-ink-400 hover:text-ink-700 ml-auto">Fechar</button>
                    </div>
                    <p className="text-[11.5px] text-ink-500 mt-2 leading-snug">Envie esta senha ao usuário. No próximo acesso ele definirá a senha própria.</p>
                  </div>
                )}
                <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
                  <h2 className="font-display text-[17px] font-bold text-ink-900">Usuários <span className="text-ink-400 font-medium text-[14px]">({usuarios.length})</span></h2>
                  <button onClick={carregar} className="text-[12px] font-medium text-brand-600 hover:text-brand-700">Atualizar</button>
                </div>
                {erro && <div className="m-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-[12.5px] text-red-700">{erro}</div>}
                {carregando
                  ? <div className="px-6 py-12 text-center text-[13px] text-ink-400">Carregando…</div>
                  : usuarios.length === 0
                    ? <div className="px-6 py-12 text-center text-[13px] text-ink-400">Nenhum usuário ainda.</div>
                    : (
                      <ul className="divide-y divide-ink-100">
                        {usuarios.map((u) => {
                          const souEu = u.id === meId;
                          return (
                            <li key={u.id} className="px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <div className="text-[13.5px] font-semibold text-ink-900 truncate">{u.nome || u.email}{souEu && <span className="ml-2 text-[11px] font-medium text-ink-400">(você)</span>}</div>
                                <div className="text-[12px] text-ink-500 truncate">{u.email}</div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${PAPEL_BADGE[u.papel]}`}>{PAPEL_LABEL[u.papel]}</span>
                                {souEu ? <span className="text-[12px] text-ink-300">—</span> : (
                                  <select value={u.papel} onChange={(e) => alterarPapel(u, e.target.value as PapelUsuario)}
                                    className="text-[12px] font-medium text-ink-700 border border-ink-200 rounded-lg px-2 py-1 bg-white outline-none focus:border-brand-400 transition">
                                    <option value="basico">Básico</option>
                                    <option value="completo">Completo</option>
                                    <option value="master">Master</option>
                                  </select>
                                )}
                                <button onClick={() => resetarSenha(u)} disabled={souEu}
                                  className="text-[12px] font-medium text-ink-500 hover:text-brand-700 disabled:text-ink-300 disabled:cursor-not-allowed whitespace-nowrap">
                                  Resetar senha
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )
                }
                <div className="px-6 py-3 border-t border-ink-100 text-[11.5px] text-ink-400 leading-snug">
                  Logado como <span className="font-medium text-ink-600">{meEmail}</span>.
                </div>
              </section>
            </div>

            {/* permissões */}
            <section className="rounded-2xl bg-white hairline-strong overflow-hidden">
              <div className="px-6 py-4 border-b border-ink-100">
                <h2 className="font-display text-[17px] font-bold text-ink-900">Permissões por perfil</h2>
                <p className="text-[12.5px] text-ink-500 mt-1">Defina quais módulos cada perfil pode acessar. Alterações têm efeito imediato.</p>
              </div>
              {carregando ? <div className="px-6 py-10 text-center text-[13px] text-ink-400">Carregando…</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-ink-100">
                        <th className="px-6 py-3 text-left text-[11px] uppercase tracking-wide text-ink-400 font-semibold w-48">Módulo</th>
                        {(["basico", "completo"] as const).map((p) => (
                          <th key={p} className="px-6 py-3 text-center text-[11px] uppercase tracking-wide text-ink-400 font-semibold">{PAPEL_LABEL[p]}</th>
                        ))}
                        <th className="px-6 py-3 text-center text-[11px] uppercase tracking-wide text-ink-400 font-semibold">Master</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-50">
                      {MODULOS.map((m) => (
                        <tr key={m.id} className="hover:bg-ink-50/50 transition">
                          <td className="px-6 py-3.5 font-medium text-ink-800">{m.label}</td>
                          {(["basico", "completo"] as const).map((p) => {
                            const chave = `${p}:${m.id}`; const permitido = getPermitido(p, m.id); const salvando = salvandoPerm === chave;
                            return (
                              <td key={p} className="px-6 py-3.5 text-center">
                                <button onClick={() => togglePermissao(p, m.id)} disabled={salvando}
                                  className={`w-9 h-5 rounded-full transition-colors relative ${permitido ? "bg-brand-400" : "bg-ink-200"} ${salvando ? "opacity-50" : ""}`}>
                                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${permitido ? "translate-x-4" : "translate-x-0"}`} />
                                </button>
                              </td>
                            );
                          })}
                          <td className="px-6 py-3.5 text-center">
                            <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">Sempre</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── aba alíquotas ─────────────────────────────────────────────── */}
        {mainTab === "aliquotas" && (
          <section className="rounded-2xl bg-white hairline-strong overflow-hidden">
            <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display text-[17px] font-bold text-ink-900">Configuração de alíquotas</h2>
                <p className="text-[12.5px] text-ink-500 mt-1">
                  Edite os valores que o simulador usa. Campos em amarelo estão com override ativo. Campos em branco usam os padrões do sistema.
                </p>
              </div>
              <button onClick={carregarAliq} className="text-[12px] font-medium text-brand-600 hover:text-brand-700 shrink-0">Recarregar</button>
            </div>

            {/* sub-tab bar */}
            <div className="px-6 pt-4 flex gap-1 border-b border-ink-100 pb-0">
              {(["cronograma", "setores", "estados"] as AbaAliq[]).map((t) => (
                <button key={t} onClick={() => setAliqTab(t)}
                  className={`px-4 py-2 text-[13px] font-semibold border-b-2 transition -mb-px ${
                    aliqTab === t ? "border-brand-400 text-brand-700" : "border-transparent text-ink-400 hover:text-ink-700"
                  }`}>
                  {t === "cronograma" ? "Cronograma CBS/IBS" : t === "setores" ? "Setores" : "Estados (ICMS)"}
                </button>
              ))}
            </div>

            {/* mensagens */}
            <div className="px-6">
              {aliqErro && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-[12.5px] text-red-700">{aliqErro}</div>}
              {aliqMsg && <div className="mt-4 rounded-lg bg-brand-50 border border-brand-100 px-3.5 py-2.5 text-[12.5px] text-brand-700">{aliqMsg}</div>}
            </div>

            {aliqCarregando
              ? <div className="px-6 py-16 text-center text-[13px] text-ink-400">Carregando…</div>
              : (
                <>
                  {/* ── cronograma ── */}
                  {aliqTab === "cronograma" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12.5px] min-w-[820px]">
                        <thead>
                          <tr className="border-b border-ink-100 bg-ink-50/60">
                            <th className="px-4 py-3 text-left font-semibold text-ink-500 text-[11px] uppercase tracking-wide">Ano</th>
                            <th className="px-4 py-3 text-center font-semibold text-ink-500 text-[11px] uppercase tracking-wide">CBS%</th>
                            <th className="px-4 py-3 text-center font-semibold text-ink-500 text-[11px] uppercase tracking-wide">IBS%</th>
                            <th className="px-4 py-3 text-center font-semibold text-ink-500 text-[11px] uppercase tracking-wide">IBS fator</th>
                            <th className="px-4 py-3 text-center font-semibold text-ink-500 text-[11px] uppercase tracking-wide">ICMS fator</th>
                            <th className="px-4 py-3 text-center font-semibold text-ink-500 text-[11px] uppercase tracking-wide">ISS fator</th>
                            <th className="px-4 py-3 text-center font-semibold text-ink-500 text-[11px] uppercase tracking-wide">Prov.</th>
                            <th className="px-4 py-3 text-center font-semibold text-ink-500 text-[11px] uppercase tracking-wide">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-50">
                          {CRON_ANOS.map((ano) => {
                            const def = cronDefaults[ano] ?? {};
                            const ov = cronOverrides[ano] ?? {};
                            const draft = cronDrafts[ano] ?? {};
                            const hasOv = Object.keys(ov).length > 0;
                            const busy = savingCron === ano;

                            const numField = (
                              field: keyof CronFields,
                              toDisplay: (v: number) => string,
                              fromDisplay: (s: string) => number | null,
                            ) => {
                              const defVal = def[field as string] as number | undefined;
                              const draftVal = draft[field as keyof CronFields] as number | null | undefined;
                              const ovVal = ov[field as keyof CronFields] as number | null | undefined;
                              const isEdited = draftVal != null;
                              return (
                                <td className="px-2 py-2 text-center" key={field}>
                                  <input
                                    type="text"
                                    value={draftVal != null ? toDisplay(draftVal as number) : ""}
                                    placeholder={defVal != null ? toDisplay(defVal) : "—"}
                                    onChange={(e) => {
                                      const v = fromDisplay(e.target.value);
                                      setCronDrafts((prev) => ({
                                        ...prev,
                                        [ano]: { ...prev[ano], [field]: v },
                                      }));
                                    }}
                                    className={`w-16 text-center rounded border px-1.5 py-1 text-[12px] outline-none transition ${
                                      isEdited
                                        ? "border-amber-300 bg-amber-50 text-amber-800"
                                        : ovVal != null
                                          ? "border-amber-200 bg-amber-50/60 text-amber-700 font-medium"
                                          : "border-ink-200 bg-white text-ink-700"
                                    } focus:border-brand-400`}
                                  />
                                </td>
                              );
                            };

                            return (
                              <tr key={ano} className={`hover:bg-ink-50/40 transition ${hasOv ? "bg-amber-50/30" : ""}`}>
                                <td className="px-4 py-2.5 font-semibold text-ink-800">
                                  {ano}
                                  {hasOv && <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">editado</span>}
                                </td>
                                {numField("cbs_percentual", (v) => (v * 100).toFixed(2), parsePct)}
                                {numField("ibs_percentual", (v) => (v * 100).toFixed(2), parsePct)}
                                {numField("ibs_fator", (v) => v.toFixed(2), parseFator)}
                                {numField("icms_fator", (v) => v.toFixed(2), parseFator)}
                                {numField("iss_fator", (v) => v.toFixed(2), parseFator)}
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={
                                      draft.aliquotas_provisorias != null
                                        ? !!draft.aliquotas_provisorias
                                        : ov.aliquotas_provisorias != null
                                          ? !!ov.aliquotas_provisorias
                                          : !!(def.aliquotas_provisorias)
                                    }
                                    onChange={(e) => setCronDrafts((prev) => ({
                                      ...prev, [ano]: { ...prev[ano], aliquotas_provisorias: e.target.checked },
                                    }))}
                                    className="w-4 h-4 accent-brand-600"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    <button onClick={() => salvarCron(ano)} disabled={busy}
                                      className="text-[11.5px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2.5 py-1 rounded-lg disabled:opacity-50 transition whitespace-nowrap">
                                      {busy ? "…" : "Salvar"}
                                    </button>
                                    {hasOv && (
                                      <button onClick={() => restaurarCron(ano)} disabled={busy}
                                        className="text-[11.5px] font-medium text-ink-500 hover:text-red-600 disabled:opacity-50 transition whitespace-nowrap">
                                        Restaurar
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="px-6 py-3 text-[11px] text-ink-400 border-t border-ink-100">
                        CBS% e IBS%: insira como porcentagem (ex.: 9.30 para 9,30%). Fatores: insira como decimal (ex.: 0.50). Células vazias usam o padrão do sistema.
                      </div>
                    </div>
                  )}

                  {/* ── setores ── */}
                  {aliqTab === "setores" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12.5px]">
                        <thead>
                          <tr className="border-b border-ink-100 bg-ink-50/60">
                            <th className="px-6 py-3 text-left font-semibold text-ink-500 text-[11px] uppercase tracking-wide">Setor</th>
                            <th className="px-4 py-3 text-center font-semibold text-ink-500 text-[11px] uppercase tracking-wide">Redução%</th>
                            <th className="px-4 py-3 text-center font-semibold text-ink-500 text-[11px] uppercase tracking-wide">IS estimado%</th>
                            <th className="px-4 py-3 text-center font-semibold text-ink-500 text-[11px] uppercase tracking-wide">ISS padrão%</th>
                            <th className="px-4 py-3 text-center font-semibold text-ink-500 text-[11px] uppercase tracking-wide">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-50">
                          {setoresDefault.map((s) => {
                            const ov = setoresOverrides[s.id] ?? {};
                            const draft = setoresDrafts[s.id] ?? {};
                            const hasOv = Object.keys(ov).length > 0;
                            const busy = savingSetor === s.id;

                            const setorNumField = (field: keyof SetorFields, defVal?: number | null) => {
                              const draftVal = draft[field] as number | null | undefined;
                              const ovVal = ov[field] as number | null | undefined;
                              const isEdited = draftVal != null;
                              return (
                                <td className="px-2 py-2 text-center" key={field}>
                                  <input
                                    type="text"
                                    value={draftVal != null ? (draftVal * 100).toFixed(2) : ""}
                                    placeholder={defVal != null ? (defVal * 100).toFixed(2) : "—"}
                                    onChange={(e) => {
                                      const v = parsePct(e.target.value);
                                      setSetoresDrafts((prev) => ({
                                        ...prev, [s.id]: { ...prev[s.id], [field]: v },
                                      }));
                                    }}
                                    className={`w-16 text-center rounded border px-1.5 py-1 text-[12px] outline-none transition ${
                                      isEdited
                                        ? "border-amber-300 bg-amber-50 text-amber-800"
                                        : ovVal != null
                                          ? "border-amber-200 bg-amber-50/60 text-amber-700 font-medium"
                                          : "border-ink-200 bg-white text-ink-700"
                                    } focus:border-brand-400`}
                                  />
                                </td>
                              );
                            };

                            return (
                              <tr key={s.id} className={`hover:bg-ink-50/40 transition ${hasOv ? "bg-amber-50/30" : ""}`}>
                                <td className="px-6 py-2.5 text-ink-800">
                                  <div className="font-medium">{s.nome}</div>
                                  {hasOv && <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">editado</span>}
                                </td>
                                {setorNumField("reducao_aliquota", s.reducao_aliquota)}
                                {setorNumField("is_estimado", s.is_estimado)}
                                {setorNumField("iss_padrao", s.iss_padrao)}
                                <td className="px-4 py-2.5 text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    <button onClick={() => salvarSetor(s.id)} disabled={busy}
                                      className="text-[11.5px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2.5 py-1 rounded-lg disabled:opacity-50 transition whitespace-nowrap">
                                      {busy ? "…" : "Salvar"}
                                    </button>
                                    {hasOv && (
                                      <button onClick={() => restaurarSetor(s.id)} disabled={busy}
                                        className="text-[11.5px] font-medium text-ink-500 hover:text-red-600 disabled:opacity-50 transition whitespace-nowrap">
                                        Restaurar
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="px-6 py-3 text-[11px] text-ink-400 border-t border-ink-100">
                        Todos os campos em porcentagem (ex.: 60.00 para 60% de redução). Células vazias usam o padrão do sistema.
                      </div>
                    </div>
                  )}

                  {/* ── estados ── */}
                  {aliqTab === "estados" && (
                    <div className="p-6">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {estadosRows.map((r) => {
                          const draft = estadosDrafts[r.uf] ?? "";
                          const busy = savingEstado === r.uf;
                          const hasOv = r.override_value != null;
                          return (
                            <div key={r.uf} className={`rounded-xl border p-3 ${hasOv ? "border-amber-200 bg-amber-50/40" : "border-ink-200 bg-white"}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-[13px] text-ink-800">{r.uf}</span>
                                {hasOv && <span className="text-[10px] font-semibold text-amber-600">editado</span>}
                              </div>
                              <div className="text-[11px] text-ink-400 mb-1.5">
                                Padrão: {(r.default_value * 100).toFixed(1)}%
                              </div>
                              <input
                                type="text"
                                value={draft}
                                placeholder={(r.default_value * 100).toFixed(2)}
                                onChange={(e) => setEstadosDrafts((prev) => ({ ...prev, [r.uf]: e.target.value }))}
                                className={`w-full text-center rounded border px-2 py-1.5 text-[13px] outline-none transition font-medium ${
                                  draft ? "border-amber-300 bg-amber-50 text-amber-800" : "border-ink-200 bg-white text-ink-700"
                                } focus:border-brand-400`}
                              />
                              <div className="mt-2 flex gap-1.5">
                                <button onClick={() => salvarEstado(r.uf)} disabled={busy || !draft}
                                  className="flex-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2 py-1 rounded-lg disabled:opacity-40 transition">
                                  {busy ? "…" : "Salvar"}
                                </button>
                                {hasOv && (
                                  <button onClick={() => restaurarEstado(r.uf)} disabled={busy}
                                    className="text-[11px] font-medium text-ink-400 hover:text-red-600 disabled:opacity-40 transition px-1.5">
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 text-[11px] text-ink-400">
                        Insira como porcentagem (ex.: 18.00 para 18%). O campo em branco usa o padrão do sistema.
                      </div>
                    </div>
                  )}
                </>
              )
            }
          </section>
        )}
      </main>
    </div>
  );
}
