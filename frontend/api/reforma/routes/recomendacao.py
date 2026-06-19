from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from ..engine.regras import get_setor, validar_mei
from ..engine.calculadora import (
    calcular_sistema_atual, calcular_sistema_novo, _irpj_csll_por_operacao,
)

router = APIRouter(prefix="/api/py", tags=["recomendacao"])

# Crédito de entrada estimado por regime (consistente com o Simulador)
_CREDITO_POR_REGIME: dict[str, float] = {
    "mei": 0.0,
    "simples_nacional": 0.0,
    "lucro_presumido": 0.3,
    "lucro_real": 0.5,
}

# Limite de faturamento anual por regime — acima disso o regime fica VEDADO no comparativo.
_LIMITE_FATURAMENTO: dict[str, tuple[float, str]] = {
    "simples_nacional": (4_800_000.0, "Faturamento anual acima do limite do Simples Nacional (R$ 4,8 milhões/ano)."),
    "lucro_presumido": (78_000_000.0, "Faturamento anual acima do limite do Lucro Presumido (R$ 78 milhões/ano) — obrigatório Lucro Real."),
}


class ComparadorInput(BaseModel):
    faturamento_anual: float = Field(..., ge=0, description="Faturamento anual em R$ (0 = zerado)")
    setor_id: str
    uf: str = Field(default="SP", min_length=2, max_length=2)
    ano: int = Field(default=2027, ge=2026, le=2033)
    percentual_credito_entrada: float = Field(default=0.4, ge=0.0, le=1.0)
    valor: float = Field(default=10000.0, ge=0, description="Valor de operação base para comparação")
    folha_pagamento_mensal: Optional[float] = Field(
        default=None, gt=0,
        description=(
            "Folha de pagamento média mensal em R$ (últimos 12 meses). "
            "Necessário para calcular o Fator R em serviços intelectuais/técnicos."
        )
    )
    despesas_mensais: Optional[float] = Field(
        default=None, gt=0,
        description=(
            "Despesas dedutíveis médias mensais em R$. Usada no Lucro Real para "
            "estimar o IRPJ/CSLL (carga total) sobre o lucro real (receita − despesas)."
        )
    )


@router.post("/comparar-regimes")
def comparar_regimes(inp: ComparadorInput):
    try:
        setor = get_setor(inp.setor_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    regimes = [
        ("mei", "MEI", "Autônomo/MEI — faturamento até R$ 81 mil/ano"),
        ("simples_nacional", "Simples Nacional", "Pequenas empresas — faturamento até R$ 4,8 milhões/ano"),
        ("lucro_presumido", "Lucro Presumido", "Empresas até R$ 78 milhões/ano — tributação simplificada"),
        ("lucro_real", "Lucro Real", "Qualquer porte — imposto sobre lucro efetivo"),
    ]

    resultados = []
    for regime_key, regime_nome, descricao in regimes:
        # ── Validação MEI ────────────────────────────────────────────────────
        if regime_key == "mei":
            mei_ok, motivo = validar_mei(setor, inp.faturamento_anual)
            if not mei_ok:
                resultados.append({
                    "regime": regime_key,
                    "nome": regime_nome,
                    "descricao": descricao,
                    "disponivel": False,
                    "motivo_indisponivel": motivo,
                    "total_atual": None,
                    "percentual_atual": None,
                    "total_novo": None,
                    "percentual_novo": None,
                    "diferenca": None,
                    "diferenca_percentual": None,
                    "economia_anual_estimada": None,
                    "irpj_csll_estimado": None,
                })
                continue

        # ── Vedação por limite de faturamento (Simples / Lucro Presumido) ─────
        lim = _LIMITE_FATURAMENTO.get(regime_key)
        if lim and inp.faturamento_anual > lim[0]:
            resultados.append({
                "regime": regime_key,
                "nome": regime_nome,
                "descricao": descricao,
                "disponivel": False,
                "motivo_indisponivel": lim[1],
                "total_atual": None,
                "percentual_atual": None,
                "total_novo": None,
                "percentual_novo": None,
                "diferenca": None,
                "diferenca_percentual": None,
                "economia_anual_estimada": None,
                "irpj_csll_estimado": None,
            })
            continue

        fat = inp.faturamento_anual if regime_key in ("simples_nacional", "mei") else None
        # Usa crédito automático por regime — Simples/MEI sem crédito, LP 30%, LR 50%
        credito = _CREDITO_POR_REGIME.get(regime_key, inp.percentual_credito_entrada)
        folha = inp.folha_pagamento_mensal if regime_key == "simples_nacional" else None

        atual = calcular_sistema_atual(inp.valor, regime_key, setor, inp.uf, fat, folha)
        novo = calcular_sistema_novo(
            inp.valor, regime_key, setor, inp.uf, inp.ano,
            credito, fat, folha,
        )
        # Carga TOTAL: soma o IRPJ/CSLL atribuível à operação (Simples/MEI já no DAS → 0).
        ic_op = _irpj_csll_por_operacao(
            regime_key, setor, inp.valor, inp.faturamento_anual, inp.despesas_mensais
        )
        total_atual = round(atual.total + ic_op, 2)
        total_novo = round(novo.total + ic_op, 2)
        diff = total_novo - total_atual
        resultados.append({
            "regime": regime_key,
            "nome": regime_nome,
            "descricao": descricao,
            "disponivel": True,
            "motivo_indisponivel": None,
            "total_atual": total_atual,
            "percentual_atual": round(total_atual / inp.valor * 100, 2) if inp.valor > 0 else 0.0,
            "total_novo": total_novo,
            "percentual_novo": round(total_novo / inp.valor * 100, 2) if inp.valor > 0 else 0.0,
            "diferenca": round(diff, 2),
            "diferenca_percentual": round(diff / total_atual * 100, 2) if total_atual > 0 else 0.0,
            "economia_anual_estimada": round(diff * 12, 2),
            "irpj_csll_estimado": ic_op,
        })

    # Ordenar: disponíveis primeiro (por total_novo), depois indisponíveis
    disponiveis = [r for r in resultados if r["disponivel"]]
    indisponiveis = [r for r in resultados if not r["disponivel"]]
    disponiveis.sort(key=lambda x: x["total_novo"])

    ordenados = disponiveis + indisponiveis
    melhor = disponiveis[0] if disponiveis else None

    return {
        "valor_base": inp.valor,
        "setor": setor["nome"],
        "uf": inp.uf.upper(),
        "ano": inp.ano,
        "comparativo": ordenados,
        "regime_mais_vantajoso": melhor["regime"] if melhor else None,
        "regime_mais_vantajoso_nome": melhor["nome"] if melhor else None,
        "obs": "Análise informativa. Consulte seu contador para decisão definitiva de regime tributário.",
    }
