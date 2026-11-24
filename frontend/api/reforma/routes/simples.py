"""
Modulo Simples Nacional — LC 214/2025
Analise comparativa Normal vs Hibrido (regime por fora), Fator R,
break-even B2B e linha do tempo de decisao.

Calculos baseados em:
  - LC 123/2006 com alteracoes da LC 214/2025 (Arts. 350-357)
  - Calculadora RTC Simples Nacional — github.com/ReceitaFederal/calculadora-rtc-simples-nacional
  - CGSN Res. 190/2026
  - Regras: impostoSeletivoCompoeReceita = 0 (IS NAO entra na receita bruta do Simples)
  - Credito para comprador B2B: ZERO no regime normal (Art. 28 LC 214/2025 — exige recolhimento
    pelo regime geral); INTEGRAL no regime hibrido (CBS + IBS calculados por fora)
"""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from ..engine.regras import (
    get_setor, get_cronograma, get_aliquota_simples,
    calcular_fator_r, FATOR_R_THRESHOLD,
    _ANEXO_III, _ANEXO_V, _aliq_efetiva,
)

router = APIRouter(prefix="/api/py", tags=["simples"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SimplesAnaliseInput(BaseModel):
    setor_id: str
    faturamento_anual: float = Field(default=360_000.0, ge=0)
    folha_pagamento_mensal: Optional[float] = Field(default=None, ge=0)
    percentual_b2b: float = Field(default=0.5, ge=0, le=1)
    percentual_credito_entrada: float = Field(default=0.3, ge=0, le=1)
    ano: int = Field(default=2027, ge=2026, le=2033)


class FatorRDetalhe(BaseModel):
    valor: float
    threshold: float
    anexo_atual: str           # "III" ou "V"
    folha_minima_iii: float    # folha mensal minima para atingir Fator R >= 28%
    muda_com_folha: bool       # se informar folha minima_iii, muda para Anexo III
    aliq_efetiva_iii: float
    aliq_efetiva_v: float
    economia_mensal_iii: float # economia mensal se mudar para Anexo III (pode ser negativa)


class SimplesOpcao(BaseModel):
    nome: str
    custo_por_operacao: float   # sobre R$1.000 de venda
    aliq_efetiva_pct: float
    componentes: list[dict]     # [{nome, aliq, valor}]
    credito_comprador_b2b: float  # credito que o comprador B2B pode abater
    custo_efetivo_comprador_b2b: float  # custo - credito (para o comprador)


class MarcoTimeline(BaseModel):
    ano: int
    mes: Optional[str]
    evento: str
    tipo: str   # "decisao" | "obrigacao" | "vigencia" | "oportunidade"
    destaque: bool


class SimplesAnaliseOutput(BaseModel):
    # Fator R
    fator_r: Optional[FatorRDetalhe]
    eh_fator_r: bool

    # DAS
    das_aliquota_pct: float
    das_mensal: float           # DAS sobre faturamento mensal
    anexo_nome: str
    aviso_fator_r: Optional[str]

    # Comparativo (base: R$1.000 de venda)
    normal: SimplesOpcao
    hibrido: SimplesOpcao
    diferenca_custo: float      # hibrido - normal (negativo = hibrido mais barato)
    break_even_b2b_pct: Optional[float]  # % B2B onde hibrido se iguala ao normal
    percentual_b2b_atual: float

    # Com o percentual B2B informado, qual vale mais?
    recomendacao_tipo: str      # "normal" | "hibrido" | "indiferente" | "dispensado"
    recomendacao: str

    # Linha do tempo
    marcos: list[MarcoTimeline]

    # Metadados
    setor_nome: str
    ano: int
    cbs_ref_pct: float
    ibs_ref_pct: float


# ─── Engine ───────────────────────────────────────────────────────────────────

_BASE_VENDA = 1_000.0  # base de calculo para o comparativo


def _calcular_analise(inp: SimplesAnaliseInput) -> SimplesAnaliseOutput:
    setor = get_setor(inp.setor_id)
    cron = get_cronograma(inp.ano)

    fat = max(inp.faturamento_anual, 1.0)
    fat_mensal = fat / 12.0
    reducao = setor.get("reducao_aliquota", 0.0)
    fator_reducao = 1.0 - reducao
    anexo_id = setor.get("anexo_simples", "III")
    eh_fator_r = (anexo_id == "FATOR_R")

    # ── Aliquota DAS ──────────────────────────────────────────────────────────
    aliq_das, base_legal, aviso_fator_r = get_aliquota_simples(
        setor, fat, inp.folha_pagamento_mensal
    )

    # Qual Anexo esta sendo usado?
    if eh_fator_r:
        if inp.folha_pagamento_mensal is not None:
            fr = calcular_fator_r(inp.folha_pagamento_mensal * 12, fat)
            anexo_nome = "III" if fr >= FATOR_R_THRESHOLD else "V"
        else:
            anexo_nome = "V"  # conservador
    else:
        anexo_nome = anexo_id

    # ── Fator R (apenas se aplicavel) ─────────────────────────────────────────
    fator_r_detalhe: Optional[FatorRDetalhe] = None
    if eh_fator_r:
        folha_12m = (inp.folha_pagamento_mensal or 0.0) * 12
        fr_val = calcular_fator_r(folha_12m, fat)
        folha_min_iii = fat * FATOR_R_THRESHOLD / 12  # folha mensal para atingir 28%
        aliq_iii, _ = _aliq_efetiva(fat, _ANEXO_III)
        aliq_v, _   = _aliq_efetiva(fat, _ANEXO_V)
        fator_r_detalhe = FatorRDetalhe(
            valor=round(fr_val * 100, 2),
            threshold=FATOR_R_THRESHOLD * 100,
            anexo_atual=anexo_nome,
            folha_minima_iii=round(folha_min_iii, 2),
            muda_com_folha=(anexo_nome == "V"),
            aliq_efetiva_iii=round(aliq_iii * 100, 4),
            aliq_efetiva_v=round(aliq_v * 100, 4),
            economia_mensal_iii=round(fat_mensal * (aliq_v - aliq_iii), 2),
        )

    # ── CBS / IBS na fase atual ───────────────────────────────────────────────
    cbs_ref = cron.get("cbs_percentual", 0.0)
    ibs_ref = cron.get("ibs_percentual", 0.0)
    ibs_fator = cron.get("ibs_fator", 0.0)
    ano_dispensado = (inp.ano == 2026)

    # Aliquotas efetivas com reducao setorial
    cbs_bruto = cbs_ref * fator_reducao
    ibs_bruto = ibs_ref * fator_reducao

    # Com credito de entrada
    cbs_liq = cbs_bruto * (1.0 - inp.percentual_credito_entrada)
    ibs_liq = ibs_bruto * (1.0 - inp.percentual_credito_entrada)

    # Valores sobre R$1.000
    B = _BASE_VENDA
    das_val = round(B * aliq_das, 2)
    cbs_val = round(B * cbs_liq, 2)
    ibs_val = round(B * ibs_liq, 2)
    cbs_bruto_val = round(B * cbs_bruto, 2)
    ibs_bruto_val = round(B * ibs_bruto, 2)

    # ── Opcao Normal ─────────────────────────────────────────────────────────
    # Referencia RFB: no regime Normal o CBS/IBS esta dentro do DAS com aliquota
    # muito reduzida; o comprador nao consegue tomar credito (Art. 28 LC 214/2025).
    # credito_comprador ≈ 0 (valor simbolico do CBS/IBS dentro do DAS).
    # Estimativa do CBS/IBS embutido no DAS: proporcao CBS/(CBS+IBS) × DAS
    das_mensal = round(fat_mensal * aliq_das, 2)
    cbs_ibs_total_ref = cbs_ref + ibs_ref
    if cbs_ibs_total_ref > 0 and not ano_dispensado:
        # CBS dentro do DAS proporcional ao peso no total das aliquotas de referencia
        cbs_peso = cbs_ref / cbs_ibs_total_ref
        cbs_no_das_estimado = round(das_val * aliq_das * cbs_peso, 2) if aliq_das > 0 else 0.0
        ibs_no_das_estimado = round(das_val * aliq_das * (1 - cbs_peso), 2) if aliq_das > 0 else 0.0
        # Na pratica o credito e quase nulo; usamos zero conforme Art. 28
        credito_normal = 0.0
    else:
        credito_normal = 0.0

    normal = SimplesOpcao(
        nome="DAS Normal (regime simplificado)",
        custo_por_operacao=das_val,
        aliq_efetiva_pct=round(aliq_das * 100, 4),
        componentes=[
            {"nome": "DAS (aliquota efetiva — CBS/IBS embutidos com aliq. reduzida)",
             "aliq_pct": round(aliq_das * 100, 4), "valor": das_val},
        ],
        credito_comprador_b2b=credito_normal,
        custo_efetivo_comprador_b2b=round(B + das_val - credito_normal, 2),
    )

    # ── Opcao Hibrido (por fora) ───────────────────────────────────────────────
    # Referencia RFB calculadora-rtc-simples-nacional:
    # - DAS e mantido integral (estimativa conservadora: coeficiente de reducao
    #   do CG-IBS ainda nao publicado — CGSN Res. 190/2026 Art. 3)
    # - CBS e IBS calculados pela aliquota de referencia plena (regime geral)
    # - IS NAO compoe receita bruta do Simples (impostoSeletivoCompoeReceita = 0)
    # - O comprador B2B tem credito integral de CBS + IBS (Art. 156-A CF/88)
    if ano_dispensado:
        hibrido_total = das_val
        componentes_hibrido = [
            {"nome": "DAS (dispensado de CBS/IBS em 2026)",
             "aliq_pct": round(aliq_das * 100, 4), "valor": das_val},
        ]
        credito_hibrido = 0.0
    else:
        hibrido_total = round(das_val + cbs_val + ibs_val, 2)
        componentes_hibrido = [
            {"nome": "DAS (estimativa conservadora — integral, pendente reg. CG-IBS)",
             "aliq_pct": round(aliq_das * 100, 4), "valor": das_val},
        ]
        if cbs_val > 0:
            cred_txt = f" (liquido {int(inp.percentual_credito_entrada*100)}% credito)"
            componentes_hibrido.append({
                "nome": f"CBS — {cbs_ref*100:.1f}% × {fator_reducao*100:.0f}% reducao{cred_txt}",
                "aliq_pct": round(cbs_liq * 100, 4), "valor": cbs_val,
            })
        if ibs_val > 0:
            cred_txt = f" (liquido {int(inp.percentual_credito_entrada*100)}% credito)"
            if ibs_fator > 0 and ibs_fator < 1:
                ibs_ref_full = ibs_ref / ibs_fator if ibs_fator > 0 else ibs_ref
                componentes_hibrido.append({
                    "nome": f"IBS — {ibs_ref_full*100:.1f}% × {int(ibs_fator*100)}% fase-in × {fator_reducao*100:.0f}% reducao{cred_txt}",
                    "aliq_pct": round(ibs_liq * 100, 4), "valor": ibs_val,
                })
            else:
                componentes_hibrido.append({
                    "nome": f"IBS — {ibs_ref*100:.1f}% × {fator_reducao*100:.0f}% reducao{cred_txt}",
                    "aliq_pct": round(ibs_liq * 100, 4), "valor": ibs_val,
                })
        credito_hibrido = round(cbs_bruto_val + ibs_bruto_val, 2)

    hibrido = SimplesOpcao(
        nome="Simples Hibrido (CBS/IBS por fora — regime geral)",
        custo_por_operacao=hibrido_total,
        aliq_efetiva_pct=round(hibrido_total / B * 100, 4),
        componentes=componentes_hibrido,
        credito_comprador_b2b=credito_hibrido,
        custo_efetivo_comprador_b2b=round(B + hibrido_total - credito_hibrido, 2),
    )

    # ── Break-even B2B ────────────────────────────────────────────────────────
    # O hibrido vale quando o custo adicional (hibrido - normal) e menor que
    # o beneficio competitivo gerado pelo credito do comprador B2B.
    # Referencia: logica do CalculoSimplesPorForaService.java (RFB)
    #   beneficio_b2b = percentual_b2b × credito_comprador_hibrido
    #   vale_hibrido = (custo_hibrido - custo_normal) < beneficio_b2b
    diferenca = round(hibrido_total - das_val, 2)
    break_even: Optional[float] = None
    if credito_hibrido > 0 and not ano_dispensado:
        be = diferenca / credito_hibrido
        break_even = round(be * 100, 1)  # em percentual

    # ── Recomendacao ──────────────────────────────────────────────────────────
    if ano_dispensado:
        rec_tipo = "dispensado"
        rec_text = (
            "Em 2026 o Simples Nacional esta dispensado de CBS e IBS. "
            "Nao ha diferenca entre Normal e Hibrido neste ano. "
            "Use 2026 para planejar: calcule seu Fator R, mapeie sua base de clientes B2B "
            "e defina ate junho/2027 se vai optar pelo regime hibrido."
        )
    elif diferenca <= 0:
        rec_tipo = "hibrido"
        rec_text = (
            "O regime Hibrido e vantajoso independente do perfil de clientes: "
            "o custo total e menor ou igual ao DAS normal, e seus clientes B2B "
            "ainda ganham credito integral de CBS/IBS."
        )
    elif break_even is not None and inp.percentual_b2b * 100 >= break_even:
        rec_tipo = "hibrido"
        rec_text = (
            f"Com {inp.percentual_b2b*100:.0f}% de clientes B2B, o regime Hibrido e vantajoso. "
            f"O custo adicional de R$ {diferenca:.2f} por R$1.000 de venda e compensado pelo "
            f"credito de R$ {credito_hibrido:.2f} que seus clientes B2B recuperam, "
            f"tornando voce mais competitivo frente a concorrentes do regime regular. "
            f"O break-even e {break_even:.0f}% B2B — voce esta acima."
        )
    elif break_even is not None:
        rec_tipo = "normal"
        rec_text = (
            f"Com {inp.percentual_b2b*100:.0f}% de clientes B2B, o DAS Normal e mais vantajoso. "
            f"O custo adicional do Hibrido seria R$ {diferenca:.2f} por R$1.000 de venda, "
            f"maior que o beneficio competitivo atual. "
            f"O break-even e {break_even:.0f}% B2B — voce precisaria passar desse percentual "
            f"para o Hibrido compensar."
        )
    else:
        rec_tipo = "normal"
        rec_text = (
            "CBS/IBS ainda nao entraram em vigor neste periodo. "
            "O DAS Normal e suficiente."
        )

    # ── Linha do Tempo ────────────────────────────────────────────────────────
    marcos = [
        MarcoTimeline(
            ano=2026, mes=None,
            evento="Dispensado de CBS/IBS. Use o ano para mapear clientes B2B e calcular Fator R.",
            tipo="oportunidade", destaque=True,
        ),
        MarcoTimeline(
            ano=2027, mes="jan-jun",
            evento="JANELA DE OPCAO: primeiro semestre para optar pelo regime Hibrido (irretratavel no semestre).",
            tipo="decisao", destaque=True,
        ),
        MarcoTimeline(
            ano=2027, mes="fev",
            evento="CBS entra em vigor (8,8% de referencia). IS comeca em 02/02/2027.",
            tipo="vigencia", destaque=True,
        ),
        MarcoTimeline(
            ano=2027, mes="jul-dez",
            evento="Segunda janela semestral — pode mudar de opcao para o 2o semestre de 2027.",
            tipo="decisao", destaque=False,
        ),
        MarcoTimeline(
            ano=2028, mes=None,
            evento="Split Payment obrigatorio para B2B: o banco separa CBS/IBS antes de depositar.",
            tipo="obrigacao", destaque=True,
        ),
        MarcoTimeline(
            ano=2029, mes=None,
            evento="IBS entra em vigor (19,2% de referencia). Sistema dual CBS + IBS pleno.",
            tipo="vigencia", destaque=True,
        ),
        MarcoTimeline(
            ano=2033, mes=None,
            evento="Sistema pleno: aliquotas definitivas fixadas pelo Senado Federal.",
            tipo="vigencia", destaque=False,
        ),
    ]

    return SimplesAnaliseOutput(
        fator_r=fator_r_detalhe,
        eh_fator_r=eh_fator_r,
        das_aliquota_pct=round(aliq_das * 100, 4),
        das_mensal=das_mensal,
        anexo_nome=anexo_nome,
        aviso_fator_r=aviso_fator_r,
        normal=normal,
        hibrido=hibrido,
        diferenca_custo=diferenca,
        break_even_b2b_pct=break_even,
        percentual_b2b_atual=round(inp.percentual_b2b * 100, 1),
        recomendacao_tipo=rec_tipo,
        recomendacao=rec_text,
        marcos=marcos,
        setor_nome=setor.get("nome", inp.setor_id),
        ano=inp.ano,
        cbs_ref_pct=round(cbs_ref * 100, 2),
        ibs_ref_pct=round(ibs_ref * 100, 2),
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/simples/analise", response_model=SimplesAnaliseOutput)
def analise_simples(inp: SimplesAnaliseInput):
    try:
        return _calcular_analise(inp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
