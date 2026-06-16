"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { ProjecaoAnual } from "./types";

interface Props {
  projecao: ProjecaoAnual[];
  valorOperacao: number;
}

export default function GraficoTransicao({ projecao, valorOperacao }: Props) {
  const dados = projecao.map((p) => ({
    ano: p.ano,
    "Novo sistema (%)": p.percentual_sobre_valor,
    "Sistema atual (%)": valorOperacao > 0
      ? parseFloat(((p.total_sistema_atual / valorOperacao) * 100).toFixed(2))
      : 0,
  }));

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">
        Evolução da carga tributária 2026–2033 (% sobre o valor da operação)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
          <YAxis unit="%" tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" ? `${value.toFixed(2)}%` : value,
              name,
            ]}
            labelFormatter={(label) => `Ano: ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="Novo sistema (%)"
            stroke="#29B5E8"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Sistema atual (%)"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-400 mt-2">
        Fonte: LC 214/2025. Projeções baseadas no cronograma oficial de transição.
        Valores sujeitos a alterações regulatórias.
      </p>
    </div>
  );
}
