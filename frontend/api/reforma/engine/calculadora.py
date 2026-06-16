from .regras import (
    get_setor, get_cronograma, get_icms_uf,
    get_aliquota_simples, get_aliquota_simples_por_anexo,
    get_iss_padrao,
    get_mei_das_mensal, get_mei_aliquota_efetiva,
    validar_mei,
    FATOR_R_THRESHOLD,
)
from ..models.schemas import (
    DetalheTributo, ResultadoSistema,
    SimulacaoInput, SimulacaoOutput,
    SimulacaoComProjecaoOutput, ProjecaoAnual,
    MarkupInput, MarkupOutput, RecomendacaoItem,
    FatorRInfo, CenarioFatorR,
    IrpjCsllInfo, MemoriaCalculo, PassoMemoria,
)


def _br(x: float) -> str:
    """Formata número no padrão brasileiro: 1.234,56."""
    s = f"{x:,.2f}"
    return s.replace(",", "§").replace(".", ",").replace("§", ".")


def _detalhe(
    nome: str, aliquota: float, valor: float, base_legal: str,
    formula: str | None = None,
) -> DetalheTributo:
    return DetalheTributo(
        nome=nome,
        aliquota_aplicada=round(aliquota * 100, 4),
        valor=round(valor, 2),
        base_legal=base_legal,
        formula=formula,
    )


def _get_pis_cofins(setor: dict, regime: str) -> tuple[float, str, float, str]:
    """
    Retorna (pis_rate, pis_base_legal, cofins_rate, cofins_base_legal).

    Setores com `pis_aliquota_especial` usam regime cumulativo obrigatório,
    independentemente do regime fiscal (Lucro Real ou Presumido).
    Exemplo: operadoras ANS — PIS 0,65% + COFINS 4% (Lei 9.718/1998).
    """
    if "pis_aliquota_especial" in setor:
        pis_r  = setor["pis_aliquota_especial"]
        cof_r  = setor["cofins_aliquota_especial"]
        pis_bl = "Lei 9.715/1998 — regime cumulativo obrigatório"
        cof_bl = "Lei 9.718/1998 — COFINS 4% específica para operadoras ANS"
        return pis_r, pis_bl, cof_r, cof_bl
    if regime == "lucro_presumido":
        return 0.0065, "Lei 9.718/1998", 0.030, "Lei 9.718/1998"
    # lucro_real — regime não-cumulativo padrão
    return 0.0165, "Lei 10.637/2002", 0.076, "Lei 10.833/2003"


def calcular_sistema_atual(
    valor: float,
    regime: str,
    setor: dict,
    uf: str,
    faturamento_anual: float | None,
    folha_pagamento_mensal: float | None = None,
    percentual_credito: float = 0.0,
) -> ResultadoSistema:
    detalhes: list[DetalheTributo] = []
    total = 0.0
    tipo = setor["tipo"]
    icms_uf = get_icms_uf(uf)

    if regime == "mei":
        # MEI paga DAS fixo mensal (não é percentual da receita)
        das_mensal = get_mei_das_mensal(setor)
        aliq_efetiva = get_mei_aliquota_efetiva(setor, faturamento_anual)
        # Para a simulação de uma operação específica, projetamos o DAS sobre a alíquota efetiva
        v = valor * aliq_efetiva
        das_anual = das_mensal * 12
        fat_ref = faturamento_anual or (das_mensal * 12 / aliq_efetiva)
        detalhes.append(_detalhe(
            f"DAS-MEI (fixo R$ {das_mensal:.2f}/mês — alíq. efetiva {aliq_efetiva*100:.2f}% s/ fat. anual)",
            aliq_efetiva, v,
            f"LC 123/2006, Art. 18-A — DAS anual R$ {das_anual:.2f} / fatur. R$ {fat_ref:,.0f}",
            formula=f"DAS-MEI fixo de R$ {_br(das_mensal)}/mês → alíq. efetiva {aliq_efetiva*100:.2f}% × R$ {_br(valor)} = R$ {_br(v)}",
        ))
        total = v

    elif regime == "simples_nacional":
        aliq, base_legal, aviso = get_aliquota_simples(setor, faturamento_anual, folha_pagamento_mensal)
        v = valor * aliq
        nome_das = "DAS (Simples Nacional)"
        if aviso and "Anexo IV" in aviso:
            nome_das = "DAS — Anexo IV (Construção/Limpeza/Vigilância)"
        detalhes.append(_detalhe(
            nome_das, aliq, v, base_legal,
            formula=f"R$ {_br(valor)} × {aliq*100:.2f}% (alíquota efetiva do Simples) = R$ {_br(v)}",
        ))
        total = v

    elif regime == "lucro_presumido":
        pis_r, pis_bl, cof_r, cof_bl = _get_pis_cofins(setor, "lucro_presumido")
        pis    = valor * pis_r
        cofins = valor * cof_r
        detalhes.append(_detalhe(
            "PIS", pis_r, pis, pis_bl,
            formula=f"R$ {_br(valor)} × {pis_r*100:.2f}% = R$ {_br(pis)} (cumulativo, sem crédito)",
        ))
        detalhes.append(_detalhe(
            "COFINS", cof_r, cofins, cof_bl,
            formula=f"R$ {_br(valor)} × {cof_r*100:.2f}% = R$ {_br(cofins)} (cumulativo, sem crédito)",
        ))
        if tipo == "produto":
            icms = valor * icms_uf
            detalhes.append(_detalhe(
                f"ICMS ({uf})", icms_uf, icms, "RICMS estadual (por dentro)",
                formula=f"R$ {_br(valor)} × {icms_uf*100:.1f}% (ICMS {uf}) = R$ {_br(icms)}",
            ))
        else:
            iss_rate = get_iss_padrao(setor)
            iss = valor * iss_rate
            detalhes.append(_detalhe(
                "ISS", iss_rate, iss, "LC 116/2003",
                formula=f"R$ {_br(valor)} × {iss_rate*100:.1f}% (ISS) = R$ {_br(iss)}",
            ))
        total = sum(d.valor for d in detalhes)

    elif regime == "lucro_real":
        pis_r, pis_bl, cof_r, cof_bl = _get_pis_cofins(setor, "lucro_real")
        # Setores com regime cumulativo especial não usam label "(não-cumulativo)"
        _cumulativo_esp = "pis_aliquota_especial" in setor
        # Regime não-cumulativo: créditos sobre insumos/serviços tributados reduzem PIS/COFINS.
        # O % de crédito representa a parcela de entradas tributadas (mesmo conceito do CBS/IBS).
        cred = 0.0 if _cumulativo_esp else percentual_credito
        pis    = valor * pis_r * (1 - cred)
        cofins = valor * cof_r * (1 - cred)
        nome_pis    = "PIS"                  if _cumulativo_esp else "PIS (não-cumulativo)"
        nome_cofins = "COFINS"               if _cumulativo_esp else "COFINS (não-cumulativo)"
        cred_txt = "" if _cumulativo_esp else f" × (1 − {cred*100:.0f}% créd.)"
        detalhes.append(_detalhe(
            nome_pis, pis_r, pis, pis_bl,
            formula=f"R$ {_br(valor)} × {pis_r*100:.2f}%{cred_txt} = R$ {_br(pis)}",
        ))
        detalhes.append(_detalhe(
            nome_cofins, cof_r, cofins, cof_bl,
            formula=f"R$ {_br(valor)} × {cof_r*100:.2f}%{cred_txt} = R$ {_br(cofins)}",
        ))
        if tipo == "produto":
            icms = valor * icms_uf
            detalhes.append(_detalhe(
                f"ICMS ({uf})", icms_uf, icms, "RICMS estadual",
                formula=f"R$ {_br(valor)} × {icms_uf*100:.1f}% (ICMS {uf}) = R$ {_br(icms)}",
            ))
        else:
            iss_rate = get_iss_padrao(setor)
            iss = valor * iss_rate
            detalhes.append(_detalhe(
                "ISS", iss_rate, iss, "LC 116/2003",
                formula=f"R$ {_br(valor)} × {iss_rate*100:.1f}% (ISS) = R$ {_br(iss)}",
            ))
        total = sum(d.valor for d in detalhes)

    return ResultadoSistema(
        total=round(total, 2),
        percentual_sobre_valor=round(total / valor * 100, 2),
        detalhes=detalhes,
    )


def calcular_sistema_novo(
    valor: float,
    regime: str,
    setor: dict,
    uf: str,
    ano: int,
    percentual_credito: float,
    faturamento_anual: float | None,
    folha_pagamento_mensal: float | None = None,
) -> ResultadoSistema:
    detalhes: list[DetalheTributo] = []
    cron = get_cronograma(ano)
    tipo = setor["tipo"]
    icms_uf = get_icms_uf(uf)

    fator_reducao = 1.0 - setor["reducao_aliquota"]

    # Regime cumulativo específico (ex.: bares e restaurantes — LC 214/2025, Art. 276):
    # é vedada a apropriação de créditos sobre insumos, então o crédito é zerado.
    if setor.get("credito_vedado"):
        percentual_credito = 0.0

    # ── Simples / MEI: diferente ──────────────────────────────────────────────
    if regime in ("simples_nacional", "mei"):
        if ano == 2026:
            if regime == "simples_nacional":
                aliq, base_legal, _ = get_aliquota_simples(setor, faturamento_anual, folha_pagamento_mensal)
            else:
                aliq = get_mei_aliquota_efetiva(setor, faturamento_anual)
                base_legal = "LC 123/2006, Art. 18-A — DAS fixo MEI"
            v = valor * aliq
            detalhes.append(_detalhe(
                "DAS (sem IBS/CBS em 2026)",
                aliq, v,
                f"LC 214/2025, Art. 350 – dispensado fase-teste | {base_legal}",
                formula=f"R$ {_br(valor)} × {aliq*100:.2f}% (DAS) = R$ {_br(v)} — IBS/CBS dispensados em 2026",
            ))
            return ResultadoSistema(
                total=round(v, 2),
                percentual_sobre_valor=round(v / valor * 100, 2),
                detalhes=detalhes,
            )
        else:
            # A partir de 2027: estimativa do regime híbrido
            if regime == "simples_nacional":
                aliq_base, base_legal, _ = get_aliquota_simples(setor, faturamento_anual, folha_pagamento_mensal)
            else:
                aliq_base = get_mei_aliquota_efetiva(setor, faturamento_anual)
                base_legal = "LC 123/2006, Art. 18-A — DAS fixo MEI"
            aliq_ajustada = aliq_base * (1 + cron["cbs_percentual"] * 0.5)
            v = valor * aliq_ajustada
            detalhes.append(_detalhe(
                "DAS (inclui CBS a partir de 2027 — estimativa)",
                aliq_ajustada, v,
                f"LC 214/2025, Art. 351; LC 123/2006 com alterações | {base_legal}",
                formula=f"R$ {_br(valor)} × {aliq_ajustada*100:.2f}% [DAS {aliq_base*100:.2f}% × (1 + {cron['cbs_percentual']*100:.1f}% × 0,5)] = R$ {_br(v)}",
            ))
            return ResultadoSistema(
                total=round(v, 2),
                percentual_sobre_valor=round(v / valor * 100, 2),
                detalhes=detalhes,
            )

    # ── Lucro Presumido / Lucro Real ──────────────────────────────────────────
    total = 0.0

    red_txt = f" × (1 − {setor['reducao_aliquota']*100:.0f}% red. setorial)" if setor.get("reducao_aliquota") else ""
    cred_txt = f" × (1 − {percentual_credito*100:.0f}% créd.)"

    # PIS/COFINS (apenas em 2026, em fase de coexistência)
    if cron["pis_cofins_ativo"]:
        pis_r, _, cof_r, _ = _get_pis_cofins(setor, regime)
        pis    = valor * pis_r * (1 - percentual_credito)
        cofins = valor * cof_r * (1 - percentual_credito)
        detalhes.append(_detalhe("PIS (em coexistência 2026)",    pis_r, pis,    "Vigente até extinção em 2027",
            formula=f"R$ {_br(valor)} × {pis_r*100:.2f}%{cred_txt} = R$ {_br(pis)}"))
        detalhes.append(_detalhe("COFINS (em coexistência 2026)", cof_r, cofins, "Vigente até extinção em 2027",
            formula=f"R$ {_br(valor)} × {cof_r*100:.2f}%{cred_txt} = R$ {_br(cofins)}"))

    # CBS
    if cron["cbs_percentual"] > 0:
        cbs_bruto = cron["cbs_percentual"] * fator_reducao
        cbs_efetivo = cbs_bruto * (1 - percentual_credito)
        cbs_valor = valor * cbs_efetivo
        detalhes.append(_detalhe(
            f"CBS (alíquota-ref. {cbs_bruto*100:.1f}%, crédito {percentual_credito*100:.0f}%)",
            cbs_efetivo, cbs_valor,
            "LC 214/2025, Art. 9º – CBS",
            formula=f"R$ {_br(valor)} × {cron['cbs_percentual']*100:.1f}% (CBS ref.){red_txt}{cred_txt} = R$ {_br(cbs_valor)}",
        ))

    # IBS
    if cron["ibs_percentual"] > 0:
        ibs_bruto = cron["ibs_percentual"] * fator_reducao
        ibs_efetivo = ibs_bruto * (1 - percentual_credito)
        ibs_valor = valor * ibs_efetivo
        detalhes.append(_detalhe(
            f"IBS (alíquota-ref. {ibs_bruto*100:.1f}%, crédito {percentual_credito*100:.0f}%)",
            ibs_efetivo, ibs_valor,
            "LC 214/2025, Art. 156-A CF – IBS",
            formula=f"R$ {_br(valor)} × {cron['ibs_percentual']*100:.1f}% (IBS ref.){red_txt}{cred_txt} = R$ {_br(ibs_valor)}",
        ))

    # ICMS em transição (produtos)
    if cron["icms_fator"] > 0 and tipo == "produto":
        icms_efetivo = icms_uf * cron["icms_fator"]
        icms_valor = valor * icms_efetivo
        detalhes.append(_detalhe(
            f"ICMS ({uf}) – {int(cron['icms_fator']*100)}% vigente",
            icms_efetivo, icms_valor,
            f"RICMS {uf} – redução conforme cronograma LC 214/2025",
            formula=f"R$ {_br(valor)} × {icms_uf*100:.1f}% (ICMS {uf}) × {int(cron['icms_fator']*100)}% (transição) = R$ {_br(icms_valor)}",
        ))

    # ISS em transição (serviços)
    if cron["iss_fator"] > 0 and tipo == "servico":
        iss_rate = get_iss_padrao(setor)
        iss_efetivo = iss_rate * cron["iss_fator"]
        iss_valor = valor * iss_efetivo
        detalhes.append(_detalhe(
            f"ISS – {int(cron['iss_fator']*100)}% vigente",
            iss_efetivo, iss_valor,
            f"LC 116/2003 – redução conforme cronograma LC 214/2025",
            formula=f"R$ {_br(valor)} × {iss_rate*100:.1f}% (ISS) × {int(cron['iss_fator']*100)}% (transição) = R$ {_br(iss_valor)}",
        ))

    # Imposto Seletivo
    if setor.get("is_aplicavel") and cron["cbs_percentual"] >= 0.093:
        is_rate = setor.get("is_estimado", 0.0)
        is_valor = valor * is_rate
        detalhes.append(_detalhe(
            f"IS – Imposto Seletivo (estimado {is_rate*100:.0f}%)",
            is_rate, is_valor,
            "LC 214/2025, Art. 409 – Imposto Seletivo (taxa sujeita a regulamentação)",
            formula=f"R$ {_br(valor)} × {is_rate*100:.0f}% (estimativa de IS) = R$ {_br(is_valor)}",
        ))

    total = sum(d.valor for d in detalhes)
    return ResultadoSistema(
        total=round(total, 2),
        percentual_sobre_valor=round(total / valor * 100, 2),
        detalhes=detalhes,
    )


def _calcular_fator_r_info(
    valor: float,
    setor: dict,
    uf: str,
    ano: int,
    percentual_credito: float,
    faturamento_anual: float | None,
    folha_pagamento_mensal: float | None,
) -> FatorRInfo | None:
    """
    Gera o bloco FatorRInfo quando o setor usa FATOR_R no Simples Nacional.
    Mostra ambos os cenários (Anexo III e Anexo V) lado a lado.
    """
    if setor.get("anexo_simples") != "FATOR_R":
        return None

    fat = faturamento_anual or 360_000.0
    folha_min_mensal = round(fat * FATOR_R_THRESHOLD / 12, 2)

    # Calcula ambos os cenários
    aliq_iii, desc_iii = get_aliquota_simples_por_anexo(fat, "III")
    aliq_v, desc_v = get_aliquota_simples_por_anexo(fat, "V")

    total_iii = round(valor * aliq_iii, 2)
    total_v = round(valor * aliq_v, 2)

    cenario_iii = CenarioFatorR(
        anexo="III",
        aliquota_efetiva=round(aliq_iii * 100, 2),
        total=total_iii,
        percentual_sobre_valor=round(aliq_iii * 100, 2),
    )
    cenario_v = CenarioFatorR(
        anexo="V",
        aliquota_efetiva=round(aliq_v * 100, 2),
        total=total_v,
        percentual_sobre_valor=round(aliq_v * 100, 2),
    )

    if folha_pagamento_mensal is not None:
        folha_12m = folha_pagamento_mensal * 12
        fr = round(folha_12m / fat, 4) if fat > 0 else 0.0
        if fr >= FATOR_R_THRESHOLD:
            anexo_usado = "III"
            mensagem = (
                f"Fator R calculado: {fr*100:.1f}% (folha R$ {folha_pagamento_mensal:,.0f}/mês × 12 "
                f"÷ faturamento R$ {fat:,.0f}). Fator R ≥ 28% → Anexo III aplicável "
                f"(alíquota efetiva {aliq_iii*100:.2f}%)."
            )
        else:
            anexo_usado = "V"
            mensagem = (
                f"Fator R calculado: {fr*100:.1f}% (folha R$ {folha_pagamento_mensal:,.0f}/mês × 12 "
                f"÷ faturamento R$ {fat:,.0f}). Fator R < 28% → Anexo V aplicável "
                f"(alíquota efetiva {aliq_v*100:.2f}%). "
                f"Para atingir Fator R ≥ 28%, a folha mensal precisaria ser ≥ R$ {folha_min_mensal:,.0f}."
            )
        return FatorRInfo(
            aplicavel=True,
            fator_r_calculado=fr,
            anexo_usado=anexo_usado,
            cenario_iii=cenario_iii,
            cenario_v=cenario_v,
            folha_minima_para_iii=folha_min_mensal,
            mensagem=mensagem,
        )
    else:
        mensagem = (
            f"Sua atividade é sujeita ao Fator R (LC 123/2006, Art. 18, § 5º-J). "
            f"Informe a folha de pagamento mensal para determinar o Anexo correto. "
            f"Enquanto isso, exibimos ambos os cenários: "
            f"Cenário A — Fator R ≥ 28% (Anexo III, {aliq_iii*100:.2f}%); "
            f"Cenário B — Fator R < 28% (Anexo V, {aliq_v*100:.2f}%). "
            f"A diferença é de R$ {abs(total_v - total_iii):,.2f} por operação. "
            f"Folha mensal mínima para Fator R ≥ 28%: R$ {folha_min_mensal:,.0f}."
        )
        return FatorRInfo(
            aplicavel=True,
            fator_r_calculado=None,
            anexo_usado="V (conservador — folha não informada)",
            cenario_iii=cenario_iii,
            cenario_v=cenario_v,
            folha_minima_para_iii=folha_min_mensal,
            mensagem=mensagem,
        )


_REGIME_LABELS = {
    "simples_nacional": "Simples Nacional",
    "lucro_presumido": "Lucro Presumido",
    "lucro_real": "Lucro Real",
    "mei": "MEI",
}


def gerar_narrativa(
    setor_nome: str,
    regime: str,
    valor: float,
    economia_ou_acrescimo: float,
    economia_percentual: float,
    reducao_setor: float,
    ano: int,
) -> str:
    label = _REGIME_LABELS.get(regime, regime)
    val_abs = abs(economia_ou_acrescimo)
    pct_abs = abs(economia_percentual)

    if ano == 2026:
        return (
            f"Em 2026, sua empresa ainda está na fase de testes da reforma tributária. "
            f"Os novos impostos (CBS e IBS) ainda não vigoram em alíquota plena. "
            f"Aproveite este período para se preparar para as mudanças que começam em 2027."
        )

    if reducao_setor >= 100 and regime not in ("simples_nacional", "mei"):
        return (
            f"Ótima notícia! O setor '{setor_nome}' tem alíquota zero no novo sistema "
            f"(Cesta Básica Nacional). Sua empresa não pagará IBS nem CBS — economia de 100% "
            f"nesses novos tributos."
        )

    if economia_ou_acrescimo < -0.01:
        beneficio = (
            f" O desconto especial de {reducao_setor:.0f}% do seu setor contribui para esse resultado."
            if reducao_setor > 0 else ""
        )
        if pct_abs >= 5:
            return (
                f"Boas notícias! Com a reforma tributária, sua empresa '{setor_nome}' ({label}) "
                f"vai pagar R$ {val_abs:,.2f} a menos por cada R$ {valor:,.0f} em operações — "
                f"uma economia de {pct_abs:.1f}%.{beneficio}"
            )
        return (
            f"Para sua empresa '{setor_nome}' ({label}), a reforma traz uma pequena economia "
            f"de R$ {val_abs:,.2f} por operação ({pct_abs:.1f}%). Impacto modesto, mas positivo."
        )

    if economia_ou_acrescimo > 0.01:
        if pct_abs >= 5:
            return (
                f"Atenção: para sua empresa '{setor_nome}' ({label}), a reforma tributária "
                f"vai aumentar a carga de impostos em R$ {val_abs:,.2f} por cada R$ {valor:,.0f} "
                f"vendidos ({pct_abs:.1f}% de acréscimo). "
                f"É importante revisar sua precificação e planejar o impacto no fluxo de caixa."
            )
        return (
            f"Para sua empresa '{setor_nome}' ({label}), a reforma representa um aumento de "
            f"R$ {val_abs:,.2f} por operação ({pct_abs:.1f}%). "
            f"O impacto é pequeno, mas vale monitorar conforme a transição avança até 2033."
        )

    return (
        f"Para sua empresa '{setor_nome}' ({label}), a reforma tributária terá impacto "
        f"praticamente neutro — diferença inferior a R$ 0,01 por operação. "
        f"Monitore as mudanças no cronograma até 2033."
    )


def gerar_recomendacoes(
    regime: str,
    setor: dict,
    economia_ou_acrescimo: float,
    economia_percentual: float,
    ano: int,
    mei_incompativel: bool = False,
    fator_r_info: "FatorRInfo | None" = None,
) -> list[RecomendacaoItem]:
    recs: list[RecomendacaoItem] = []
    reducao = setor.get("reducao_aliquota", 0) * 100
    eh_simples = regime in ("simples_nacional", "mei")

    # Alerta MEI incompatível
    if mei_incompativel and regime == "mei":
        recs.append(RecomendacaoItem(
            titulo="⛔ MEI não permitido para esta atividade",
            texto=(
                "Esta atividade não pode optar pelo MEI. Considere Simples Nacional "
                "ou outro regime adequado. Consulte seu contador."
            ),
            icone="🔴",
            prioridade="alta",
        ))

    # Alerta Fator R sem folha informada
    if fator_r_info and fator_r_info.aplicavel and fator_r_info.fator_r_calculado is None:
        recs.append(RecomendacaoItem(
            titulo="Informe a folha de pagamento para cálculo exato",
            texto=(
                "Sua atividade usa o Fator R para definir o Anexo do Simples Nacional. "
                f"Se a folha mensal for ≥ R$ {fator_r_info.folha_minima_para_iii:,.0f}, "
                f"o Anexo III se aplica ({fator_r_info.cenario_iii.aliquota_efetiva:.2f}%). "
                f"Caso contrário, Anexo V ({fator_r_info.cenario_v.aliquota_efetiva:.2f}%). "
                "A diferença pode ser significativa — calcule com precisão."
            ),
            icone="🟡",
            prioridade="alta",
        ))

    if reducao >= 100 and not eh_simples:
        recs.append(RecomendacaoItem(
            titulo="Alíquota zero: máximo benefício",
            texto=(
                "Sua empresa está na Cesta Básica Nacional e não pagará IBS nem CBS. "
                "Comunique isso aos seus clientes como diferencial competitivo e revise "
                "seus preços para refletir a economia."
            ),
            icone="🟢",
            prioridade="alta",
        ))
    elif reducao >= 60 and not eh_simples:
        recs.append(RecomendacaoItem(
            titulo=f"Redução especial de {reducao:.0f}% no seu setor",
            texto=(
                f"Seu setor tem desconto de {reducao:.0f}% nas alíquotas do IBS e CBS. "
                f"Em vez de pagar ~28%, você paga ~{28*(1-reducao/100):.1f}%. "
                f"Use isso a seu favor na formação de preços."
            ),
            icone="🟢",
            prioridade="alta",
        ))
    elif reducao >= 30 and not eh_simples:
        recs.append(RecomendacaoItem(
            titulo=f"Redução de {reducao:.0f}% no seu setor",
            texto=(
                f"Seu setor tem desconto de {reducao:.0f}% nas alíquotas do IBS e CBS. "
                f"Confirme com seu contador se sua atividade se enquadra corretamente "
                f"nessa categoria para garantir o benefício."
            ),
            icone="🟡",
            prioridade="media",
        ))

    if setor.get("is_aplicavel"):
        recs.append(RecomendacaoItem(
            titulo="Imposto Seletivo (IS) incide sobre seu produto",
            texto=(
                "Seu setor está sujeito ao Imposto Seletivo, com alíquotas ainda a serem "
                "regulamentadas. Monitore as publicações do governo e prepare sua "
                "precificação para esse custo adicional significativo."
            ),
            icone="🔴",
            prioridade="alta",
        ))

    if economia_ou_acrescimo > 0 and abs(economia_percentual) >= 3:
        recs.append(RecomendacaoItem(
            titulo="Revise seus preços antes de 2027",
            texto=(
                f"Sua carga tributária vai aumentar {abs(economia_percentual):.1f}% com a reforma. "
                f"Para manter a mesma margem de lucro, você precisará reajustar os preços. "
                f"Use a calculadora de markup para calcular o novo preço ideal."
            ),
            icone="🟡",
            prioridade="alta" if abs(economia_percentual) >= 5 else "media",
        ))

    if abs(economia_percentual) >= 10 and regime in ("simples_nacional", "lucro_presumido"):
        recs.append(RecomendacaoItem(
            titulo="Vale a pena mudar de regime tributário?",
            texto=(
                f"Com uma diferença de {abs(economia_percentual):.1f}% na carga tributária, "
                f"pode ser vantajoso avaliar a migração para outro regime. Consulte seu contador "
                f"sobre o regime híbrido (Simples + IBS/CBS pelo regime regular)."
            ),
            icone="🟡",
            prioridade="media",
        ))

    if regime in ("lucro_presumido", "lucro_real") and ano >= 2027:
        recs.append(RecomendacaoItem(
            titulo="Prepare seu capital de giro para o Split Payment",
            texto=(
                "A partir de 2027, quando um cliente te pagar, o banco vai separar "
                "automaticamente o valor do imposto (CBS e IBS) antes de depositar na sua conta. "
                "Você sempre vai receber menos que o valor da nota. "
                "Planeje seu fluxo de caixa com essa nova realidade."
            ),
            icone="🔵",
            prioridade="media",
        ))

    if eh_simples and ano == 2026:
        recs.append(RecomendacaoItem(
            titulo="Use 2026 para se preparar",
            texto=(
                "Em 2026, você ainda está isento dos novos impostos (CBS/IBS). "
                "Use este período para entender como seu negócio será afetado a partir de 2027 "
                "e tome decisões antecipadas de precificação e regime tributário."
            ),
            icone="🔵",
            prioridade="alta",
        ))

    return recs[:4]


def _calcular_irpj_csll_info(
    regime: str,
    setor: dict,
    valor: float,
    faturamento_anual: float | None,
    faturamento_mensal: float | None = None,
    despesas_mensais: float | None = None,
) -> IrpjCsllInfo:
    """
    Gera informação sobre IRPJ/CSLL para exibição ao usuário.
    - Simples/MEI: já incluídos no DAS.
    - Lucro Presumido: estimativa possível com base na presunção de lucro.
    - Lucro Real: não estimável sem dados contábeis.
    """
    if regime in ("simples_nacional", "mei"):
        return IrpjCsllInfo(
            incluido_no_das=True,
            mensagem_leigo=(
                "No Simples Nacional e no MEI, o IRPJ e a CSLL já fazem parte do DAS "
                "(Documento de Arrecadação do Simples). Você não os paga separadamente."
            ),
        )

    if regime == "lucro_real":
        # Estimável quando o usuário informa faturamento e despesas médias mensais.
        if faturamento_mensal and despesas_mensais is not None:
            lucro_mensal = faturamento_mensal - despesas_mensais
            if lucro_mensal <= 0:
                return IrpjCsllInfo(
                    estimavel=True,
                    irpj_estimado=0.0, csll_estimado=0.0,
                    irpj_percentual=0.0, csll_percentual=0.0,
                    adicional_irpj_possivel=False,
                    mensagem_leigo=(
                        f"Com receita de R$ {_br(faturamento_mensal)}/mês e despesas de "
                        f"R$ {_br(despesas_mensais)}/mês, o lucro real é zero ou negativo — "
                        f"sem IRPJ/CSLL a recolher no período. (Estimativa; confirme com seu contador.)"
                    ),
                )
            irpj_base = lucro_mensal * 0.15
            adicional = max(0.0, lucro_mensal - 20_000.0) * 0.10
            irpj_total = irpj_base + adicional
            csll = lucro_mensal * 0.09
            adic_txt = (
                f" + 10% sobre R$ {_br(lucro_mensal - 20_000.0)} (excedente de R$ 20.000/mês)"
                if adicional > 0 else ""
            )
            return IrpjCsllInfo(
                estimavel=True,
                irpj_estimado=round(irpj_total, 2),
                csll_estimado=round(csll, 2),
                irpj_percentual=round(irpj_total / faturamento_mensal * 100, 2),
                csll_percentual=round(csll / faturamento_mensal * 100, 2),
                adicional_irpj_possivel=adicional > 0,
                mensagem_leigo=(
                    f"Lucro real ≈ R$ {_br(lucro_mensal)}/mês (receita R$ {_br(faturamento_mensal)} − "
                    f"despesas R$ {_br(despesas_mensais)}). IRPJ = 15% × lucro{adic_txt} = "
                    f"R$ {_br(irpj_total)}/mês; CSLL = 9% × lucro = R$ {_br(csll)}/mês. "
                    f"Total IRPJ+CSLL ≈ R$ {_br(irpj_total + csll)}/mês. "
                    f"Estimativa — confirme com seu contador. (A reforma não altera IRPJ/CSLL.)"
                ),
            )
        return IrpjCsllInfo(
            estimavel=False,
            mensagem_leigo=(
                "No Lucro Real, IRPJ (15% + adicional de 10% sobre lucro > R$ 20.000/mês) "
                "e CSLL (9%) incidem sobre o lucro contábil apurado. Informe o faturamento e as "
                "despesas médias mensais para estimar, ou consulte seu contador."
            ),
        )

    # Lucro Presumido: estimativa baseada na presunção padrão
    tipo = setor.get("tipo", "servico")
    if tipo == "produto":
        pres_irpj, pres_csll = 0.08, 0.12   # comércio / indústria
        tipo_label = "comércio/indústria"
    else:
        pres_irpj, pres_csll = 0.32, 0.32   # serviços
        tipo_label = "serviços"

    irpj_pct  = pres_irpj * 0.15            # alíquota IRPJ 15%
    csll_pct  = pres_csll * 0.09            # alíquota CSLL 9%
    irpj_val  = round(valor * irpj_pct, 2)
    csll_val  = round(valor * csll_pct, 2)
    total_pct = (irpj_pct + csll_pct) * 100

    # Risco de adicional IRPJ 10% — lucro presumido anual > R$ 240k
    adicional = False
    if faturamento_anual and (faturamento_anual * pres_irpj) > 240_000:
        adicional = True
    adic_txt = (
        " Atenção: pode incidir adicional de 10% de IRPJ sobre o lucro acima de "
        "R$ 20.000/mês (R$ 240.000/ano)." if adicional else ""
    )

    return IrpjCsllInfo(
        estimavel=True,
        irpj_estimado=irpj_val,
        csll_estimado=csll_val,
        irpj_percentual=round(irpj_pct * 100, 2),
        csll_percentual=round(csll_pct * 100, 2),
        adicional_irpj_possivel=adicional,
        mensagem_leigo=(
            f"Estimativa para Lucro Presumido ({tipo_label}): IRPJ ≈ {irpj_pct*100:.2f}% "
            f"+ CSLL ≈ {csll_pct*100:.2f}% = ≈ {total_pct:.2f}% sobre a receita da operação. "
            f"Base: presunção de {int(pres_irpj*100)}% (IRPJ) e {int(pres_csll*100)}% (CSLL) "
            f"conforme RIR/1999 e IN RFB 1.700/2017.{adic_txt}"
        ),
    )


def _irpj_csll_por_operacao(
    regime: str,
    setor: dict,
    valor: float,
    faturamento_anual: float | None,
    despesas_mensais: float | None,
) -> float:
    """
    IRPJ + CSLL atribuível a uma operação de 'valor', para comparar a CARGA TOTAL
    entre regimes (Comparador). O total anual é rateado para a operação pela fração
    (valor / faturamento_anual).

    - Simples/MEI: IRPJ/CSLL já estão no DAS → retorna 0 (não soma de novo).
    - Lucro Presumido: presunção legal (8%/12% produto; 32%/32% serviço) + adicional.
    - Lucro Real: sobre o lucro real (faturamento − despesas) + adicional 10% > R$ 240k/ano.
                  Sem despesas informadas → retorna 0 (não estimável).
    """
    if regime in ("simples_nacional", "mei"):
        return 0.0
    if not faturamento_anual or faturamento_anual <= 0:
        return 0.0

    tipo = setor.get("tipo", "servico")
    if regime == "lucro_presumido":
        if tipo == "produto":
            pres_irpj, pres_csll = 0.08, 0.12
        else:
            pres_irpj, pres_csll = 0.32, 0.32
        lucro_irpj = faturamento_anual * pres_irpj
        lucro_csll = faturamento_anual * pres_csll
        irpj_anual = lucro_irpj * 0.15 + max(0.0, lucro_irpj - 240_000.0) * 0.10
        csll_anual = lucro_csll * 0.09
    elif regime == "lucro_real":
        if despesas_mensais is None:
            return 0.0
        lucro_anual = faturamento_anual - despesas_mensais * 12.0
        if lucro_anual <= 0:
            return 0.0
        irpj_anual = lucro_anual * 0.15 + max(0.0, lucro_anual - 240_000.0) * 0.10
        csll_anual = lucro_anual * 0.09
    else:
        return 0.0

    total_anual = irpj_anual + csll_anual
    return round(total_anual * (valor / faturamento_anual), 2)


def simular(inp: SimulacaoInput) -> SimulacaoComProjecaoOutput:
    setor = get_setor(inp.setor_id)
    cron = get_cronograma(inp.ano)

    # ── Validação MEI ─────────────────────────────────────────────────────────
    mei_incompativel = False
    mei_motivo: str | None = None

    if inp.regime == "mei":
        ok, motivo = validar_mei(setor, inp.faturamento_anual)
        if not ok:
            mei_incompativel = True
            mei_motivo = motivo

    # ── Cálculo principal ─────────────────────────────────────────────────────
    atual = calcular_sistema_atual(
        inp.valor, inp.regime, setor, inp.uf,
        inp.faturamento_anual, inp.folha_pagamento_mensal,
        inp.percentual_credito_entrada,
    )
    novo = calcular_sistema_novo(
        inp.valor, inp.regime, setor, inp.uf, inp.ano,
        inp.percentual_credito_entrada, inp.faturamento_anual,
        inp.folha_pagamento_mensal
    )

    diferenca = novo.total - atual.total
    diferenca_pct = (diferenca / atual.total * 100) if atual.total > 0 else 0.0

    # ── Fator R ───────────────────────────────────────────────────────────────
    fator_r_info: FatorRInfo | None = None
    if inp.regime == "simples_nacional":
        fator_r_info = _calcular_fator_r_info(
            inp.valor, setor, inp.uf, inp.ano,
            inp.percentual_credito_entrada,
            inp.faturamento_anual, inp.folha_pagamento_mensal
        )

    # ── Alerta ────────────────────────────────────────────────────────────────
    alerta: str | None = None
    if mei_incompativel:
        alerta = f"⛔ MEI não permitido: {mei_motivo}"
    elif inp.regime in ("simples_nacional", "mei") and inp.ano == 2026:
        alerta = (
            "Simples Nacional e MEI estão dispensados de apurar IBS/CBS até 2026. "
            "O sistema novo só impacta a partir de 2027."
        )
    elif inp.regime in ("simples_nacional", "mei") and inp.ano >= 2027:
        alerta = (
            "⚠️ Estimativa: para Simples Nacional a partir de 2027, este simulador usa uma projeção "
            "do impacto provável do regime híbrido (CBS/IBS incorporados ao DAS). "
            "A regulamentação definitiva ainda não foi publicada — os valores reais podem ser diferentes. "
            "Consulte seu contador para decisões estratégicas."
        )
    elif setor.get("reducao_aliquota") == 1.0:
        alerta = (
            "Setor com alíquota zero no novo sistema (Cesta Básica Nacional ou medicamentos essenciais). "
            "Não haverá IBS nem CBS sobre estas operações."
        )
    elif setor.get("is_aplicavel"):
        alerta = (
            "⚠️ Atenção: este setor está sujeito ao Imposto Seletivo (IS). "
            "As alíquotas mostradas são ESTIMATIVAS de mercado — o decreto regulamentador "
            "ainda não foi publicado. Os valores reais podem ser significativamente diferentes."
        )

    if fator_r_info and fator_r_info.fator_r_calculado is None and not alerta:
        alerta = (
            "⚠️ Fator R não calculado: folha de pagamento não informada. "
            "Os resultados usam Anexo V (conservador). Informe a folha mensal para cálculo exato."
        )

    # ── Projeção 2026–2033 ────────────────────────────────────────────────────
    projecao = []
    for ano in range(2026, 2034):
        novo_ano = calcular_sistema_novo(
            inp.valor, inp.regime, setor, inp.uf, ano,
            inp.percentual_credito_entrada, inp.faturamento_anual,
            inp.folha_pagamento_mensal
        )
        cron_ano = get_cronograma(ano)
        projecao.append(ProjecaoAnual(
            ano=ano,
            descricao=cron_ano["descricao"],
            total_sistema_novo=novo_ano.total,
            percentual_sobre_valor=novo_ano.percentual_sobre_valor,
            total_sistema_atual=atual.total,
            diferenca=round(novo_ano.total - atual.total, 2),
        ))

    narrativa = gerar_narrativa(
        setor["nome"], inp.regime, inp.valor,
        round(diferenca, 2), round(diferenca_pct, 2),
        setor["reducao_aliquota"] * 100, inp.ano,
    )
    recomendacoes = gerar_recomendacoes(
        inp.regime, setor, round(diferenca, 2), round(diferenca_pct, 2), inp.ano,
        mei_incompativel=mei_incompativel,
        fator_r_info=fator_r_info,
    )

    irpj_csll_info = _calcular_irpj_csll_info(
        inp.regime, setor, inp.valor, inp.faturamento_anual,
        inp.faturamento_mensal, inp.despesas_mensais,
    )

    # ── Memória de cálculo (premissas + passos de IRPJ/CSLL) ──────────────────
    iss_setor_aliq = get_iss_padrao(setor) if setor.get("tipo") == "servico" else 0.0
    passos_irpj: list[PassoMemoria] = []
    if (inp.regime == "lucro_real" and irpj_csll_info and irpj_csll_info.estimavel
            and inp.faturamento_mensal and inp.despesas_mensais is not None):
        lucro = inp.faturamento_mensal - inp.despesas_mensais
        passos_irpj.append(PassoMemoria(
            rotulo="Lucro real mensal",
            formula=f"R$ {_br(inp.faturamento_mensal)} (receita) − R$ {_br(inp.despesas_mensais)} (despesas) = R$ {_br(lucro)}",
            valor=round(lucro, 2),
        ))
        if lucro > 0:
            passos_irpj.append(PassoMemoria(
                rotulo="IRPJ (15% + adic. 10%)",
                formula=("15% × R$ " + _br(lucro)
                         + (f" + 10% × R$ {_br(lucro - 20_000.0)}" if lucro > 20_000.0 else "")
                         + f" = R$ {_br(irpj_csll_info.irpj_estimado or 0.0)}/mês"),
                valor=irpj_csll_info.irpj_estimado or 0.0,
            ))
            passos_irpj.append(PassoMemoria(
                rotulo="CSLL (9%)",
                formula=f"9% × R$ {_br(lucro)} = R$ {_br(irpj_csll_info.csll_estimado or 0.0)}/mês",
                valor=irpj_csll_info.csll_estimado or 0.0,
            ))

    memoria = MemoriaCalculo(
        valor_operacao=inp.valor,
        regime=inp.regime,
        setor_nome=setor["nome"],
        uf=inp.uf.upper(),
        ano=inp.ano,
        percentual_credito_entrada=inp.percentual_credito_entrada,
        faturamento_mensal=inp.faturamento_mensal,
        despesas_mensais=inp.despesas_mensais,
        reducao_setor=setor.get("reducao_aliquota", 0.0),
        aliquota_icms_uf=get_icms_uf(inp.uf),
        iss_setor=iss_setor_aliq,
        cbs_percentual=cron["cbs_percentual"],
        ibs_percentual=cron["ibs_percentual"],
        icms_fator=cron["icms_fator"],
        iss_fator=cron["iss_fator"],
        pis_cofins_ativo=cron.get("pis_cofins_ativo", False),
        passos_irpj_csll=passos_irpj,
        observacoes=[
            "Os tributos sobre consumo são calculados por operação, sobre o valor informado.",
            "IRPJ e CSLL incidem sobre o lucro (mensal/anual) e NÃO entram no comparativo da reforma — a reforma não altera esses tributos.",
            "Alíquotas de referência de IBS/CBS são provisórias (sujeitas a Resolução do Senado).",
        ],
    )

    return SimulacaoComProjecaoOutput(
        valor_operacao=inp.valor,
        regime=inp.regime,
        setor_nome=setor["nome"],
        ano=inp.ano,
        uf=inp.uf.upper(),
        sistema_atual=atual,
        sistema_novo=novo,
        economia_ou_acrescimo=round(diferenca, 2),
        economia_percentual=round(diferenca_pct, 2),
        reducao_setor_aplicada=setor["reducao_aliquota"] * 100,
        is_aplicavel=setor.get("is_aplicavel", False),
        descricao_ano=cron["descricao"],
        alerta=alerta,
        narrativa=narrativa,
        recomendacoes=recomendacoes,
        fator_r_info=fator_r_info,
        mei_incompativel=mei_incompativel,
        mei_motivo=mei_motivo,
        irpj_csll_info=irpj_csll_info,
        projecao_2026_2033=projecao,
        memoria_calculo=memoria,
    )


def calcular_markup(inp: MarkupInput) -> MarkupOutput:
    setor = get_setor(inp.setor_id)

    # Carga tributária atual
    atual = calcular_sistema_atual(1.0, inp.regime, setor, inp.uf, None)
    carga_atual = atual.total  # já é percentual (calculado sobre 1.0)

    # Carga tributária nova
    novo = calcular_sistema_novo(
        1.0, inp.regime, setor, inp.uf, inp.ano,
        inp.percentual_credito_entrada, None
    )
    carga_nova = novo.total

    # Preço de venda = Custo / (1 - Margem% - DespesasFixas% - CargaTributária%)
    def preco_venda(custo, carga):
        divisor = 1.0 - inp.margem_desejada - inp.despesas_fixas_percentual - carga
        if divisor <= 0:
            divisor = 0.01
        return custo / divisor

    pv_atual = preco_venda(inp.custo, carga_atual)
    pv_novo = preco_venda(inp.custo, carga_nova)

    markup_atual = pv_atual / inp.custo if inp.custo > 0 else 1.0
    markup_novo = pv_novo / inp.custo if inp.custo > 0 else 1.0

    obs = (
        "⚠️ Split Payment: no novo sistema, o fisco debita IBS/CBS diretamente na conta bancária "
        "no momento do recebimento. Isso impacta o capital de giro – o valor líquido disponível "
        "é automaticamente reduzido. Considere esse efeito no planejamento de caixa."
    )

    return MarkupOutput(
        custo=inp.custo,
        margem_desejada=round(inp.margem_desejada * 100, 2),
        preco_venda_sistema_atual=round(pv_atual, 2),
        preco_venda_sistema_novo=round(pv_novo, 2),
        diferenca_preco=round(pv_novo - pv_atual, 2),
        markup_atual=round(markup_atual, 4),
        markup_novo=round(markup_novo, 4),
        carga_tributaria_atual_percentual=round(carga_atual * 100, 2),
        carga_tributaria_nova_percentual=round(carga_nova * 100, 2),
        aliquota_efetiva_nova=round(carga_nova * 100, 2),
        obs_split_payment=obs,
    )
