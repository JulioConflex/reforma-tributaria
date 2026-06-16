"use client";

import { useState } from "react";
import type { SimulacaoResult, DetalheTributo, FatorRInfo, IrpjCsllInfo } from "./types";
import GraficoTransicao from "./GraficoTransicao";
import Recomendacoes from "./Recomendacoes";
import TooltipGlossario from "./TooltipGlossario";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Mapeia nomes técnicos para nomes simplificados
function nomeFriendly(nome: string): string {
  if (nome.startsWith("CBS")) return "Novo Imposto Federal (CBS)";
  if (nome.startsWith("IBS")) return "Novo Imposto Est./Municipal (IBS)";
  if (nome.startsWith("IS –")) return "Imposto sobre Produto Especial (IS) ⚠️";
  if (nome.startsWith("PIS")) return "Contrib. Federal (PIS)";
  if (nome.startsWith("COFINS")) return "Contrib. Federal (COFINS)";
  if (nome.startsWith("ICMS")) return nome.replace(/ICMS \((\w{2})\)/, "Imposto Estadual ($1)");
  if (nome.startsWith("ISS")) return "Imposto Municipal (ISS)";
  if (nome.startsWith("DAS")) return nome;
  return nome;
}

// Semáforo de impacto
function Semaforo({ pct }: { pct: number }) {
  if (pct <= -5)
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-green-800 text-sm">
        <span className="w-3 h-3 rounded-full bg-green-500 inline-block shrink-0" />
        <span className="font-medium">Seu setor é beneficiado pela reforma</span>
      </div>
    );
  if (pct >= 5)
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-red-800 text-sm">
        <span className="w-3 h-3 rounded-full bg-red-500 inline-block shrink-0" />
        <span className="font-medium">Atenção: sua carga tributária vai aumentar</span>
      </div>
    );
  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-amber-800 text-sm">
      <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shrink-0" />
      <span className="font-medium">Impacto neutro — fique de olho na transição</span>
    </div>
  );
}

function TabelaTributos({ detalhes }: { detalhes: DetalheTributo[] }) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="mt-3">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-600">
            <th className="text-left px-2 py-1.5 font-medium rounded-tl">Tributo</th>
            <th className="text-right px-2 py-1.5 font-medium">Alíquota</th>
            <th className="text-right px-2 py-1.5 font-medium rounded-tr">Valor</th>
          </tr>
        </thead>
        <tbody>
          {detalhes.map((d, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-2 py-1.5 text-slate-700">
                <div>{nomeFriendly(d.nome)}</div>
                {expandido && (
                  <div className="text-slate-400 text-[10px] leading-tight mt-0.5">
                    {d.base_legal}
                  </div>
                )}
              </td>
              <td className="px-2 py-1.5 text-right text-slate-600">
                {d.aliquota_aplicada.toFixed(2)}%
              </td>
              <td className="px-2 py-1.5 text-right font-medium text-slate-800">
                {brl(d.valor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => setExpandido((v) => !v)}
        className="mt-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
      >
        {expandido ? "▲ Ocultar detalhes técnicos" : "▼ Ver base legal"}
      </button>
    </div>
  );
}

function FatorRCard({ info }: { info: FatorRInfo }) {
  if (!info.aplicavel) return null;

  const semFolha = info.fator_r_calculado == null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-amber-600 text-lg mt-0.5">⚖️</span>
        <div>
          <h4 className="font-semibold text-amber-900 text-sm">
            Fator R — Qual Anexo do Simples Nacional se aplica?
          </h4>
          <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
            {info.mensagem}
          </p>
        </div>
      </div>

      {semFolha && info.cenario_iii && info.cenario_v && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Cenário A — Anexo III */}
          <div className="rounded-lg border border-green-200 bg-white px-3 py-3">
            <div className="text-xs font-semibold text-green-700 mb-1">
              Cenário A — Fator R ≥ 28% → Anexo III
            </div>
            <div className="text-xs text-slate-500 mb-0.5">
              (folha ≥ R$ {info.folha_minima_para_iii?.toLocaleString("pt-BR", {minimumFractionDigits: 0})}/mês)
            </div>
            <div className="text-xl font-bold text-green-800">
              {brl(info.cenario_iii.total)}
            </div>
            <div className="text-xs text-green-600 mt-0.5">
              Alíquota efetiva: {info.cenario_iii.aliquota_efetiva.toFixed(2)}%
            </div>
          </div>

          {/* Cenário B — Anexo V */}
          <div className="rounded-lg border border-orange-200 bg-white px-3 py-3">
            <div className="text-xs font-semibold text-orange-700 mb-1">
              Cenário B — Fator R &lt; 28% → Anexo V
            </div>
            <div className="text-xs text-slate-500 mb-0.5">
              (folha &lt; R$ {info.folha_minima_para_iii?.toLocaleString("pt-BR", {minimumFractionDigits: 0})}/mês)
            </div>
            <div className="text-xl font-bold text-orange-800">
              {brl(info.cenario_v.total)}
            </div>
            <div className="text-xs text-orange-600 mt-0.5">
              Alíquota efetiva: {info.cenario_v.aliquota_efetiva.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {!semFolha && (
        <div className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm">
          <span className="font-semibold text-brand-600">Anexo aplicável: </span>
          <span className="text-slate-700">{info.anexo_usado}</span>
          {info.fator_r_calculado != null && (
            <span className="ml-2 text-xs text-slate-500">
              (Fator R = {(info.fator_r_calculado * 100).toFixed(1)}%)
            </span>
          )}
        </div>
      )}

      <div className="text-[11px] text-amber-700 border-t border-amber-200 pt-2">
        Base legal: LC 123/2006, Art. 18, § 5º-J (Fator R); Anexos III e V da tabela do Simples Nacional.
        Informe a folha de pagamento para cálculo exato.
      </div>
    </div>
  );
}

/* ── Card IRPJ/CSLL ─────────────────────────────────────────────── */
function IrpjCsllCard({ info }: { info: IrpjCsllInfo }) {
  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Simples Nacional / MEI: já incluído → card verde
  if (info.incluido_no_das) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">✅</span>
          <div>
            <p className="font-semibold text-green-800 text-sm">
              IRPJ e CSLL já incluídos no DAS
            </p>
            <p className="text-xs text-green-700 mt-1">{info.mensagem_leigo}</p>
          </div>
        </div>
      </div>
    );
  }

  // Lucro Presumido (estimável) → card âmbar com valores
  if (info.estimavel) {
    const totalPct = (info.irpj_percentual ?? 0) + (info.csll_percentual ?? 0);
    const totalVal = (info.irpj_estimado ?? 0) + (info.csll_estimado ?? 0);
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">⚠️</span>
          <div>
            <p className="font-semibold text-amber-900 text-sm">
              IRPJ e CSLL <span className="underline decoration-dotted">não estão incluídos</span> neste cálculo
            </p>
            <p className="text-xs text-amber-800 mt-1">
              A Reforma Tributária não extingue o{" "}
              <TooltipGlossario termo="irpj">IRPJ</TooltipGlossario> e a{" "}
              <TooltipGlossario termo="csll">CSLL</TooltipGlossario>. Esses
              tributos continuam sendo apurados sobre o <strong>lucro</strong>{" "}
              da empresa, separadamente dos impostos sobre vendas.
            </p>
          </div>
        </div>

        {/* Estimativas */}
        <div className="rounded-lg border border-amber-200 bg-white/70 px-4 py-3 space-y-2">
          <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
            Estimativa indicativa — Lucro Presumido
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-amber-100 px-3 py-2 text-center">
              <TooltipGlossario termo="irpj">
                <p className="text-amber-700 font-medium">IRPJ</p>
              </TooltipGlossario>
              <p className="text-amber-900 font-bold mt-0.5">
                ≈ {brl(info.irpj_estimado ?? 0)}
              </p>
              <p className="text-amber-600 text-[10px]">
                {(info.irpj_percentual ?? 0).toFixed(2)}% da operação
              </p>
            </div>
            <div className="rounded bg-amber-100 px-3 py-2 text-center">
              <TooltipGlossario termo="csll">
                <p className="text-amber-700 font-medium">CSLL</p>
              </TooltipGlossario>
              <p className="text-amber-900 font-bold mt-0.5">
                ≈ {brl(info.csll_estimado ?? 0)}
              </p>
              <p className="text-amber-600 text-[10px]">
                {(info.csll_percentual ?? 0).toFixed(2)}% da operação
              </p>
            </div>
            <div className="rounded bg-amber-200 px-3 py-2 text-center">
              <p className="text-amber-700 font-medium">Total</p>
              <p className="text-amber-900 font-bold mt-0.5">
                ≈ {brl(totalVal)}
              </p>
              <p className="text-amber-600 text-[10px]">
                {totalPct.toFixed(2)}% da operação
              </p>
            </div>
          </div>
          {info.adicional_irpj_possivel && (
            <p className="text-[10px] text-amber-700 border-t border-amber-200 pt-2">
              ⚠️ Pode incidir adicional de 10% de IRPJ sobre o lucro que exceder R$ 20.000/mês (R$ 240.000/ano).
            </p>
          )}
          <p className="text-[10px] text-amber-600 border-t border-amber-200 pt-2">
            {info.mensagem_leigo}
          </p>
        </div>

        <p className="text-[11px] text-amber-700">
          💡 Consulte seu contador para a carga tributária total incluindo IRPJ e CSLL.
        </p>
      </div>
    );
  }

  // Lucro Real: não estimável → card âmbar simples
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">⚠️</span>
        <div>
          <p className="font-semibold text-amber-900 text-sm">
            IRPJ e CSLL <span className="underline decoration-dotted">não estão incluídos</span> neste cálculo
          </p>
          <p className="text-xs text-amber-800 mt-1">{info.mensagem_leigo}</p>
          <p className="text-[11px] text-amber-700 mt-2">
            💡 Consulte seu contador para a carga tributária total incluindo IRPJ e CSLL.
          </p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  resultado: SimulacaoResult;
}

export default function ResultadoSimulacao({ resultado: r }: Props) {
  const aumento = r.economia_ou_acrescimo > 0;
  const diferenca = Math.abs(r.economia_ou_acrescimo);
  const label = aumento ? "Acréscimo" : "Economia";
  const cor = aumento ? "text-red-600" : "text-green-600";

  return (
    <div className="mt-8 space-y-5">
      {/* Alerta */}
      {r.alerta && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {r.alerta}
        </div>
      )}

      {/* Narrativa em linguagem natural */}
      {r.narrativa && (
        <div className="rounded-xl bg-slate-800 text-white px-5 py-4">
          <div className="flex flex-wrap gap-2 text-xs text-slate-300 mb-3">
            <span>
              Setor:{" "}
              <strong className="text-white">{r.setor_nome}</strong>
            </span>
            <span>
              Regime:{" "}
              <strong className="text-white">{r.regime.replace(/_/g, " ")}</strong>
            </span>
            <span>
              UF: <strong className="text-white">{r.uf}</strong>
            </span>
            <span>
              Ano: <strong className="text-white">{r.ano}</strong>
            </span>
            {r.reducao_setor_aplicada > 0 && (
              <span className="rounded bg-brand-600 px-2 py-0.5 text-white">
                Redução {r.reducao_setor_aplicada.toFixed(0)}% (LC 214/2025)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-100 leading-relaxed">{r.narrativa}</p>
          <p className="text-xs text-slate-400 mt-2">{r.descricao_ano}</p>
        </div>
      )}

      {/* Semáforo */}
      <Semaforo pct={r.economia_percentual} />

      {/* MEI incompatível */}
      {r.mei_incompativel && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-5 py-4">
          <div className="font-bold text-red-800 text-base mb-1">⛔ MEI não permitido para esta atividade</div>
          <p className="text-sm text-red-700 leading-relaxed">{r.mei_motivo}</p>
          <p className="text-xs text-red-600 mt-2">
            Os valores abaixo foram calculados para fins comparativos, mas o enquadramento MEI é juridicamente
            inviável para este setor. Considere Simples Nacional ou outro regime adequado.
          </p>
        </div>
      )}

      {/* Fator R */}
      {r.fator_r_info?.aplicavel && (
        <FatorRCard info={r.fator_r_info} />
      )}

      {/* Banner IS estimado */}
      {r.is_aplicavel && (
        <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">⚠️ Imposto Seletivo (IS) — alíquotas estimadas:</span>{" "}
          Os valores do IS exibidos abaixo são <strong>estimativas de mercado</strong>. A LC 214/2025 prevê
          o imposto, mas as alíquotas definitivas dependem de decreto regulamentador ainda não publicado.
          Os valores reais podem ser significativamente diferentes.
        </div>
      )}

      {/* Cards comparativos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sistema atual */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Sistema Atual</h3>
            <span className="text-xs bg-slate-100 text-slate-500 rounded px-2 py-0.5">
              <TooltipGlossario termo="pis">PIS</TooltipGlossario>
              {"/"}
              <TooltipGlossario termo="cofins">COFINS</TooltipGlossario>
              {" + "}
              <TooltipGlossario termo="icms">ICMS</TooltipGlossario>
              {"/"}
              <TooltipGlossario termo="iss">ISS</TooltipGlossario>
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {brl(r.sistema_atual.total)}
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            {r.sistema_atual.percentual_sobre_valor.toFixed(2)}% sobre o valor
          </div>
          <TabelaTributos detalhes={r.sistema_atual.detalhes} />
        </div>

        {/* Sistema novo */}
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-brand-800">
              Sistema Novo (LC 214/2025)
            </h3>
            <span className="text-xs bg-brand-100 text-brand-600 rounded px-2 py-0.5">
              <TooltipGlossario termo="ibs">IBS</TooltipGlossario>
              {" + "}
              <TooltipGlossario termo="cbs">CBS</TooltipGlossario>
              {r.is_aplicavel && (
                <>
                  {" + "}
                  <TooltipGlossario termo="is">IS</TooltipGlossario>
                </>
              )}
            </span>
          </div>
          <div className="text-2xl font-bold text-brand-800">
            {brl(r.sistema_novo.total)}
          </div>
          <div className="text-sm text-brand-600 mt-0.5">
            {r.sistema_novo.percentual_sobre_valor.toFixed(2)}% sobre o valor
          </div>
          <TabelaTributos detalhes={r.sistema_novo.detalhes} />
        </div>
      </div>

      {/* Resultado líquido */}
      <div
        className={`rounded-xl border px-5 py-4 ${
          aumento ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{aumento ? "↑" : "↓"}</span>
          <div>
            <div className={`text-lg font-bold ${cor}`}>
              {label} de {brl(diferenca)} (
              {Math.abs(r.economia_percentual).toFixed(2)}%)
            </div>
            <div className="text-sm text-slate-600">
              Comparando {r.ano} (novo sistema) com sistema atual.{" "}
              <TooltipGlossario termo="credito_entrada">
                Créditos de entrada
              </TooltipGlossario>{" "}
              já aplicados nos cálculos do novo sistema.
            </div>
          </div>
        </div>
      </div>

      {/* IRPJ / CSLL — aviso de tributos não incluídos */}
      {r.irpj_csll_info && <IrpjCsllCard info={r.irpj_csll_info} />}

      {/* Recomendações */}
      {r.recomendacoes?.length > 0 && (
        <Recomendacoes recomendacoes={r.recomendacoes} />
      )}

      {/* Gráfico de projeção */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-800 mb-1">
          Projeção 2026–2033
        </h3>
        <p className="text-xs text-slate-500 mb-2">
          Como sua carga tributária evolui ao longo da transição para o{" "}
          <TooltipGlossario termo="iva_dual">IVA Dual</TooltipGlossario>.
        </p>
        <GraficoTransicao
          projecao={r.projecao_2026_2033}
          valorOperacao={r.valor_operacao}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="text-left px-2 py-1.5 font-medium">Ano</th>
                <th className="text-left px-2 py-1.5 font-medium hidden sm:table-cell">
                  Fase
                </th>
                <th className="text-right px-2 py-1.5 font-medium">
                  Total tributos
                </th>
                <th className="text-right px-2 py-1.5 font-medium">
                  % sobre valor
                </th>
                <th className="text-right px-2 py-1.5 font-medium">
                  Diferença
                </th>
              </tr>
            </thead>
            <tbody>
              {r.projecao_2026_2033.map((p) => (
                <tr
                  key={p.ano}
                  className={`border-b border-slate-100 ${
                    p.ano === r.ano
                      ? "bg-brand-50 font-semibold"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-2 py-1.5">
                    {p.ano}
                    {p.ano === r.ano && " ←"}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500 hidden sm:table-cell">
                    {p.descricao}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {brl(p.total_sistema_novo)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {p.percentual_sobre_valor.toFixed(2)}%
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right ${
                      p.diferenca > 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {p.diferenca > 0 ? "+" : ""}
                    {brl(p.diferenca)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-3 pt-3 border-t">
          * Projeções baseadas em alíquotas de referência provisórias (CBS ~9,3% + IBS ~18,7%).
          Valores sujeitos à aprovação pelo Senado Federal. Cronograma de transição: LC 214/2025, Arts. 350–357.
        </p>
      </div>
    </div>
  );
}
