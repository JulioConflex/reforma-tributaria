"use client";

import { useState, useEffect } from "react";
import type { Setor, ComparadorResult, ComparativoRegime } from "./types";
import { UFS, API } from "./types";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const REGIME_DESC: Record<string, string> = {
  mei: "Até R$ 81 mil/ano • Pagamento fixo mensal",
  simples_nacional: "Até R$ 4,8 mi/ano • Guia DAS unificada",
  lucro_presumido: "Até R$ 78 mi/ano • Tributação simplificada",
  lucro_real: "Qualquer porte • Imposto sobre lucro efetivo",
};

function LinhaRegime({
  r,
  melhor,
  index,
}: {
  r: ComparativoRegime;
  melhor: boolean;
  index: number;
}) {
  if (!r.disponivel) {
    return (
      <tr className="border-b border-slate-100 bg-slate-50/80 opacity-70">
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 font-bold leading-none whitespace-nowrap">
              ⛔ Vedado
            </span>
            <div>
              <div className="text-slate-500 line-through text-sm">{r.nome}</div>
              <div className="text-xs text-red-600 font-normal max-w-xs leading-tight">
                {r.motivo_indisponivel}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-center text-slate-400 text-xs" colSpan={3}>
          —
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`border-b border-slate-100 ${
        melhor
          ? "bg-green-50 font-semibold"
          : index % 2 === 0
          ? "bg-white"
          : "bg-slate-50/50"
      }`}
    >
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          {melhor && (
            <span className="rounded-full bg-green-500 text-white text-[10px] px-1.5 py-0.5 font-bold leading-none">
              ✓ Melhor
            </span>
          )}
          <div>
            <div className="text-slate-800">{r.nome}</div>
            <div className="text-xs text-slate-400 font-normal">
              {REGIME_DESC[r.regime]}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-right text-slate-600">
        <div>{brl(r.total_atual ?? 0)}</div>
        <div className="text-xs text-slate-400">
          {(r.percentual_atual ?? 0).toFixed(1)}%
        </div>
      </td>
      <td
        className={`px-3 py-3 text-right ${
          melhor ? "text-green-700" : "text-slate-800"
        }`}
      >
        <div>{brl(r.total_novo ?? 0)}</div>
        <div className="text-xs text-slate-400">
          {(r.percentual_novo ?? 0).toFixed(1)}%
        </div>
      </td>
      <td
        className={`px-3 py-3 text-right ${
          (r.diferenca ?? 0) > 0
            ? "text-red-600"
            : (r.diferenca ?? 0) < 0
            ? "text-green-600"
            : "text-slate-500"
        }`}
      >
        <div>
          {(r.diferenca ?? 0) > 0 ? "+" : ""}
          {brl(r.diferenca ?? 0)}
        </div>
        <div className="text-xs opacity-70">
          {(r.diferenca_percentual ?? 0) > 0 ? "+" : ""}
          {(r.diferenca_percentual ?? 0).toFixed(1)}%
        </div>
      </td>
    </tr>
  );
}

export default function ComparadorRegimes() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [faturamento, setFaturamento] = useState("360000");
  const [setorId, setSetorId] = useState("comercio_geral");
  const [valor, setValor] = useState("10000");
  const [uf, setUf] = useState("SP");
  const [ano, setAno] = useState(2027);
  const [folhaPagamento, setFolhaPagamento] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ComparadorResult | null>(null);

  useEffect(() => {
    fetch(`${API}/api/setores`)
      .then((r) => r.json())
      .then((d) => setSetores(d.setores))
      .catch(() => {});
  }, []);

  const setorSelecionado = setores.find((s) => s.id === setorId);
  const mostrarFatorR = setorSelecionado?.anexo_simples === "FATOR_R";

  const comparar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    setResultado(null);
    try {
      const body: Record<string, unknown> = {
        faturamento_anual: parseFloat(faturamento),
        setor_id: setorId,
        uf,
        ano,
        valor: parseFloat(valor),
        percentual_credito_entrada: 0.4,
      };
      if (mostrarFatorR && folhaPagamento) {
        body.folha_pagamento_mensal = parseFloat(folhaPagamento);
      }
      const res = await fetch(`${API}/api/comparar-regimes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erro ao comparar regimes");
      setResultado(await res.json());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400";
  const labelCls = "block text-xs font-medium text-slate-600 mb-1";

  const temRegimeVedado = resultado?.comparativo.some((r) => !r.disponivel);

  return (
    <div className="space-y-5">
      <form
        onSubmit={comparar}
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="font-semibold text-slate-800 mb-1">
          Compare os 4 regimes tributários
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Descubra qual regime paga menos imposto para o seu tipo de negócio.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Valor de uma operação típica (R$)</label>
            <input
              type="number"
              min="1"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={inputCls}
              required
            />
            <div className="text-xs text-slate-400 mt-1">
              Ex: valor de uma venda ou serviço comum
            </div>
          </div>
          <div>
            <label className={labelCls}>Faturamento anual estimado (R$)</label>
            <input
              type="number"
              min="1"
              value={faturamento}
              onChange={(e) => setFaturamento(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Setor de atividade</label>
            <select
              value={setorId}
              onChange={(e) => setSetorId(e.target.value)}
              className={inputCls}
            >
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>UF</label>
            <select
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className={inputCls}
            >
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Ano de referência: {ano}</label>
            <input
              type="range"
              min={2026}
              max={2033}
              value={ano}
              onChange={(e) => setAno(parseInt(e.target.value))}
              className="w-full mt-2"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>2026</span>
              <span>2033</span>
            </div>
          </div>

          {mostrarFatorR && (
            <div>
              <label className={labelCls}>
                Folha de pagamento mensal (R$){" "}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="number"
                min="1"
                value={folhaPagamento}
                onChange={(e) => setFolhaPagamento(e.target.value)}
                className={inputCls}
                placeholder="Ex: 5000"
              />
              <div className="text-xs text-amber-700 mt-1">
                ⚖️ Necessário para calcular o Fator R (Anexo III vs V no Simples)
              </div>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={carregando || setores.length === 0}
          className="mt-5 w-full sm:w-auto rounded-lg bg-brand-400 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
        >
          {carregando ? "Comparando..." : "Comparar regimes"}
        </button>
      </form>

      {erro && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {resultado && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-800">
              Resultado para: {resultado.setor} — {resultado.uf} — {resultado.ano}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Base: operação de {brl(resultado.valor_base)} • Imposto por operação
            </p>
          </div>

          {temRegimeVedado && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
              ⛔ Um ou mais regimes estão marcados como <strong>Vedados</strong> para esta atividade
              e não são exibidos como opção válida.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-brand-50 text-brand-700 text-xs">
                  <th className="text-left px-3 py-2 font-medium rounded-tl">
                    Regime
                  </th>
                  <th className="text-right px-3 py-2 font-medium">
                    Sistema atual
                  </th>
                  <th className="text-right px-3 py-2 font-medium">
                    Novo sistema
                  </th>
                  <th className="text-right px-3 py-2 font-medium rounded-tr">
                    Diferença
                  </th>
                </tr>
              </thead>
              <tbody>
                {resultado.comparativo.map((r, i) => {
                  const melhor = r.regime === resultado.regime_mais_vantajoso;
                  return (
                    <LinhaRegime key={r.regime} r={r} melhor={melhor} index={i} />
                  );
                })}
              </tbody>
            </table>
          </div>

          {resultado.regime_mais_vantajoso_nome && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              <span className="font-semibold">
                Regime mais vantajoso em {resultado.ano}:
              </span>{" "}
              {resultado.regime_mais_vantajoso_nome} — menor carga tributária no novo
              sistema para este setor.
            </div>
          )}

          <p className="text-xs text-slate-400">{resultado.obs}</p>

          {/* Aviso IRPJ/CSLL */}
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <strong>⚠️ Atenção:</strong>{" "}
            <strong>IRPJ</strong> (Imposto de Renda) e <strong>CSLL</strong> (Contribuição
            Social sobre o Lucro) <strong>não estão incluídos</strong> nesta comparação.
            Esses tributos incidem sobre o lucro e são apurados separadamente.{" "}
            <span className="text-amber-700">
              No Simples Nacional e no MEI, IRPJ e CSLL já fazem parte do DAS.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
