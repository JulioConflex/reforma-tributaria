"use client";

import { useState, useRef } from "react";
import { API } from "./types";

interface ItemManual {
  id: number;
  descricao: string;
  ncm: string;
  valor: string;
}

interface SimItem {
  descricao: string;
  ncm: string;
  valor: number;
  categoria: string;
  reducao_pct: number;
  cbs: number;
  ibs: number;
  is_: number;
  total_tributos: number;
  credito_comprador: number;
  cst: string;
  gera_credito: boolean;
}

interface SimResult {
  itens: SimItem[];
  totais: {
    valor_nota: number;
    cbs_total: number;
    ibs_total: number;
    is_total: number;
    tributos_total: number;
    carga_pct: number;
    credito_b2b_total: number;
    credito_b2b_pct: number;
  };
  regime_comprador: string;
  observacao: string;
}

const REGIMES_COMPRADOR = [
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "simples_hibrido", label: "Simples Híbrido" },
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "mei", label: "MEI" },
];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number) {
  return `${v.toFixed(2)}%`;
}

function parseXmlItens(xml: string): Array<{ descricao: string; ncm: string; valor: number; quantidade: number; unidade: string }> {
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const dets = doc.querySelectorAll("det");
    const itens: Array<{ descricao: string; ncm: string; valor: number; quantidade: number; unidade: string }> = [];
    dets.forEach((det) => {
      const ncm = (det.querySelector("NCM")?.textContent || "").replace(/\D/g, "");
      if (!ncm) return;
      itens.push({
        descricao: (det.querySelector("xProd")?.textContent || "").slice(0, 80),
        ncm,
        valor: parseFloat(det.querySelector("vProd")?.textContent || "0") || 0,
        quantidade: parseFloat(det.querySelector("qCom")?.textContent || "1") || 1,
        unidade: det.querySelector("uCom")?.textContent || "UN",
      });
    });
    return itens;
  } catch {
    return [];
  }
}

let _nextId = 2;

export default function NfeTab() {
  const [modo, setModo] = useState<"manual" | "xml">("manual");
  const [regime, setRegime] = useState("lucro_presumido");
  const [itens, setItens] = useState<ItemManual[]>([
    { id: 1, descricao: "", ncm: "", valor: "" },
  ]);
  const [xmlTexto, setXmlTexto] = useState("");
  const [xmlNomeArquivo, setXmlNomeArquivo] = useState("");
  const [resultado, setResultado] = useState<SimResult | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addItem() {
    setItens((prev) => [...prev, { id: _nextId++, descricao: "", ncm: "", valor: "" }]);
  }

  function removeItem(id: number) {
    setItens((prev) => prev.length > 1 ? prev.filter((i) => i.id !== id) : prev);
  }

  function updateItem(id: number, field: keyof ItemManual, value: string) {
    setItens((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setXmlNomeArquivo(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setXmlTexto(ev.target?.result as string || "");
    reader.readAsText(file, "UTF-8");
  }

  async function calcular() {
    setErro(null);
    setResultado(null);
    let payload: Array<{ descricao: string; ncm: string; valor: number; quantidade: number; unidade: string }>;

    if (modo === "xml") {
      payload = parseXmlItens(xmlTexto);
      if (!payload.length) {
        setErro("Nenhum item com NCM encontrado no XML. Verifique se é um arquivo NF-e válido.");
        return;
      }
    } else {
      payload = itens
        .filter((i) => i.ncm.trim() && parseFloat(i.valor.replace(",", ".")) > 0)
        .map((i) => ({
          descricao: i.descricao || `Item ${i.id}`,
          ncm: i.ncm.trim(),
          valor: parseFloat(i.valor.replace(",", ".")) || 0,
          quantidade: 1,
          unidade: "UN",
        }));
      if (!payload.length) {
        setErro("Preencha ao menos um item com NCM e valor.");
        return;
      }
    }

    setCalculando(true);
    try {
      const r = await fetch(`${API}/documentos/simular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens: payload, regime_comprador: regime }),
      });
      if (!r.ok) throw new Error("Erro no servidor");
      setResultado(await r.json());
    } catch {
      setErro("Falha ao calcular. Verifique a conexão com o servidor.");
    } finally {
      setCalculando(false);
    }
  }

  const xmlItensCount = xmlTexto ? parseXmlItens(xmlTexto).length : 0;

  return (
    <div className="mt-7 max-w-5xl mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="rounded-2xl bg-white hairline-strong p-6">
        <div className="text-[11px] uppercase tracking-[0.10em] text-brand-500 font-semibold mb-1">
          Crédito por documento fiscal
        </div>
        <h2 className="font-display text-[22px] font-bold text-ink-900 leading-tight">
          Simulador NF-e / Crédito B2B
        </h2>
        <p className="mt-1.5 text-[13.5px] text-ink-500 leading-relaxed">
          Simule CBS, IBS e Imposto Seletivo por item de nota fiscal e calcule o crédito que o comprador pode recuperar no regime B2B da LC 214/2025.
        </p>
      </div>

      {/* Configuração */}
      <div className="rounded-2xl bg-white hairline-strong p-6 space-y-5">

        {/* Regime do comprador */}
        <div>
          <div className="text-[11.5px] uppercase tracking-[0.09em] text-ink-500 font-semibold mb-2.5">
            Regime do comprador
          </div>
          <div className="flex flex-wrap gap-2">
            {REGIMES_COMPRADOR.map((r) => (
              <button
                key={r.value}
                onClick={() => setRegime(r.value)}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition border ${
                  regime === r.value
                    ? "bg-brand-50 text-brand-700 border-brand-300"
                    : "bg-white text-ink-600 border-ink-200 hover:border-brand-300"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {(regime === "simples_nacional" || regime === "mei") && (
            <div className="mt-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-[12px] text-amber-800">
              <span className="font-semibold">Simples Nacional / MEI:</span> o crédito B2B é zero. Optantes pelo regime padrão não são contribuintes de CBS/IBS e não aproveitam créditos de entrada.
            </div>
          )}
          {regime === "simples_hibrido" && (
            <div className="mt-2.5 rounded-lg bg-blue-50 border border-blue-200 px-3.5 py-2.5 text-[12px] text-blue-800">
              <span className="font-semibold">Simples Nacional Híbrido (LC 214/2025, Art. 16):</span> empresa optante pelo regime diferenciado de CBS/IBS — recolhe CBS/IBS separadamente do DAS e aproveita créditos de entrada normalmente.
            </div>
          )}
        </div>

        {/* Modo de entrada */}
        <div>
          <div className="text-[11.5px] uppercase tracking-[0.09em] text-ink-500 font-semibold mb-2.5">
            Entrada de dados
          </div>
          <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
            {(["manual", "xml"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setModo(m); setResultado(null); setErro(null); }}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${
                  modo === m ? "bg-white text-brand-700 shadow-sm" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {m === "manual" ? "Entrada manual" : "Upload XML"}
              </button>
            ))}
          </div>
        </div>

        {/* Entrada manual */}
        {modo === "manual" && (
          <div className="space-y-3">
            <div className="hidden sm:grid grid-cols-[2fr_1.2fr_1fr_32px] gap-2 px-1">
              {["Descrição", "NCM (8 dígitos)", "Valor (R$)", ""].map((h) => (
                <div key={h} className="text-[11px] uppercase tracking-[0.08em] text-ink-400 font-semibold">
                  {h}
                </div>
              ))}
            </div>
            {itens.map((item) => (
              <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[2fr_1.2fr_1fr_32px] gap-2 items-center">
                <input
                  type="text"
                  placeholder="Ex: Arroz tipo 1 branco polido 5kg"
                  value={item.descricao}
                  onChange={(e) => updateItem(item.id, "descricao", e.target.value)}
                  className="rounded-lg border border-ink-200 px-3 py-2.5 text-[13px] text-ink-900 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
                />
                <input
                  type="text"
                  placeholder="10063010"
                  value={item.ncm}
                  onChange={(e) => updateItem(item.id, "ncm", e.target.value.replace(/\D/g, ""))}
                  maxLength={8}
                  className="rounded-lg border border-ink-200 px-3 py-2.5 text-[13px] font-mono text-ink-900 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100 tracking-widest"
                />
                <input
                  type="text"
                  placeholder="0,00"
                  value={item.valor}
                  onChange={(e) => updateItem(item.id, "valor", e.target.value)}
                  className="rounded-lg border border-ink-200 px-3 py-2.5 text-[13px] text-ink-900 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100 text-right"
                />
                <button
                  onClick={() => removeItem(item.id)}
                  disabled={itens.length === 1}
                  className="p-1.5 rounded-lg text-ink-300 hover:text-red-500 disabled:opacity-20 transition"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              onClick={addItem}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-600 hover:text-brand-700 transition mt-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Adicionar item
            </button>
          </div>
        )}

        {/* Upload XML */}
        {modo === "xml" && (
          <div className="space-y-3">
            <div
              className="border-2 border-dashed border-ink-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleArquivo}
              />
              <svg
                className="mx-auto mb-3 text-ink-300"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
              <div className="text-[13.5px] font-medium text-ink-700">
                {xmlTexto ? "XML carregado — clique para trocar" : "Clique ou arraste o arquivo NF-e (.xml)"}
              </div>
              <div className="text-[12px] text-ink-400 mt-1">Formato XML da NF-e padrão SEFAZ</div>
            </div>
            {xmlTexto && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-[12.5px] text-emerald-800 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>
                  <span className="font-semibold">{xmlNomeArquivo}</span> carregado
                  {xmlItensCount > 0 && ` — ${xmlItensCount} item${xmlItensCount !== 1 ? "s" : ""} com NCM encontrado${xmlItensCount !== 1 ? "s" : ""}`}
                </span>
              </div>
            )}
          </div>
        )}

        {erro && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-[12.5px] text-red-700">
            {erro}
          </div>
        )}

        <button
          onClick={calcular}
          disabled={calculando}
          className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[14px] font-semibold transition disabled:opacity-50"
        >
          {calculando ? "Calculando…" : "Simular CBS/IBS e Crédito B2B"}
        </button>
      </div>

      {/* Resultados */}
      {resultado && (
        <>
          {/* Cards totais */}
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                label: "Total da nota",
                value: fmt(resultado.totais.valor_nota),
                sub: "Valor bruto dos itens",
                destaque: false,
              },
              {
                label: "CBS + IBS + IS total",
                value: fmt(resultado.totais.tributos_total),
                sub: fmtPct(resultado.totais.carga_pct) + " do valor da nota",
                destaque: false,
              },
              {
                label: "Crédito B2B recuperável",
                value: fmt(resultado.totais.credito_b2b_total),
                sub: fmtPct(resultado.totais.credito_b2b_pct) + " do valor da nota",
                destaque: resultado.totais.credito_b2b_total > 0,
              },
            ].map((m) => (
              <div
                key={m.label}
                className={`rounded-2xl border p-5 ${m.destaque ? "bg-emerald-50 border-emerald-300" : "bg-white border-ink-200"}`}
              >
                <div className="text-[11px] uppercase tracking-[0.09em] text-ink-500 font-semibold mb-1">
                  {m.label}
                </div>
                <div className={`text-[24px] font-bold tab-num leading-tight ${m.destaque ? "text-emerald-800" : "text-ink-900"}`}>
                  {m.value}
                </div>
                <div className="text-[12px] text-ink-400 mt-0.5">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Composição */}
          <div className="rounded-2xl bg-white hairline-strong p-6">
            <h3 className="text-[13.5px] font-semibold text-ink-900 mb-4">Composição tributária</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { label: "CBS", v: resultado.totais.cbs_total },
                { label: "IBS", v: resultado.totais.ibs_total },
                { label: "IS", v: resultado.totais.is_total },
              ].map((t) => (
                <div key={t.label} className="rounded-xl bg-ink-50 border border-ink-100 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.09em] text-ink-500 font-semibold">
                    {t.label}
                  </div>
                  <div className="text-[18px] font-bold text-ink-900 tab-num">{fmt(t.v)}</div>
                  <div className="text-[12px] text-ink-400">
                    {resultado.totais.valor_nota
                      ? fmtPct((t.v / resultado.totais.valor_nota) * 100)
                      : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabela por item */}
          <div className="rounded-2xl bg-white hairline-strong p-6">
            <h3 className="text-[13.5px] font-semibold text-ink-900 mb-4">Detalhamento por item</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-ink-100">
                    {["Produto / NCM", "CST", "Valor", "CBS", "IBS", "IS", "Crédito B2B"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-400 font-semibold pb-2.5 pr-4 last:pr-0 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.itens.map((item, i) => (
                    <tr key={i} className="border-b border-ink-50 last:border-0">
                      <td className="py-2.5 pr-4 max-w-[200px]">
                        <div className="text-ink-800 font-medium truncate">{item.descricao}</div>
                        <div className="text-[11px] text-ink-400 font-mono">{item.ncm}</div>
                        <div className="text-[11px] text-ink-400">{item.categoria}</div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                          {item.cst}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 tab-num text-ink-800">{fmt(item.valor)}</td>
                      <td className="py-2.5 pr-4 tab-num text-ink-700">{fmt(item.cbs)}</td>
                      <td className="py-2.5 pr-4 tab-num text-ink-700">{fmt(item.ibs)}</td>
                      <td className="py-2.5 pr-4 tab-num text-ink-700">
                        {item.is_ > 0 ? fmt(item.is_) : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="py-2.5 tab-num">
                        {item.gera_credito ? (
                          <span className="font-semibold text-emerald-700">{fmt(item.credito_comprador)}</span>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-ink-400 mt-4">{resultado.observacao}</p>
          </div>
        </>
      )}
    </div>
  );
}
