import json
from pathlib import Path
from functools import lru_cache

_BASE = Path(__file__).parent.parent.parent / "dados"


@lru_cache(maxsize=1)
def _load(nome: str) -> dict:
    with open(_BASE / f"{nome}.json", encoding="utf-8") as f:
        return json.load(f)


def get_setor(setor_id: str) -> dict:
    setores = {s["id"]: s for s in _load("setores")["setores"]}
    if setor_id not in setores:
        raise ValueError(f"Setor '{setor_id}' não encontrado.")
    return setores[setor_id]


def listar_setores() -> list[dict]:
    return _load("setores")["setores"]


def get_cronograma(ano: int) -> dict:
    dados = _load("cronograma")["anos"]
    key = str(ano)
    if key not in dados:
        raise ValueError(f"Ano {ano} fora do período de transição (2026–2033).")
    return dados[key]


def get_icms_uf(uf: str) -> float:
    estados = _load("estados")["icms_interno"]
    return estados.get(uf.upper(), 0.18)


# ─────────────────────────────────────────────────────────────────────────────
# Tabelas do Simples Nacional — LC 123/2006, Anexos I a V
# Cada linha: (limite_rbt12, aliquota_nominal, parcela_a_deduzir)
# ─────────────────────────────────────────────────────────────────────────────

# Anexo I — Comércio
_ANEXO_I = [
    (180_000,    0.040, 0),
    (360_000,    0.073, 5_940),
    (720_000,    0.095, 13_860),
    (1_800_000,  0.107, 22_500),
    (3_600_000,  0.143, 87_300),
    (4_800_000,  0.190, 378_000),
]

# Anexo II — Indústria
_ANEXO_II = [
    (180_000,    0.045, 0),
    (360_000,    0.078, 5_940),
    (720_000,    0.100, 13_860),
    (1_800_000,  0.112, 22_500),
    (3_600_000,  0.147, 85_500),
    (4_800_000,  0.300, 720_000),
]

# Anexo III — Serviços e Locação de Bens Móveis
_ANEXO_III = [
    (180_000,    0.060, 0),
    (360_000,    0.112, 9_360),
    (720_000,    0.135, 17_640),
    (1_800_000,  0.160, 35_640),
    (3_600_000,  0.210, 125_640),
    (4_800_000,  0.330, 648_000),
]

# Anexo IV — Construção Civil, Limpeza, Vigilância, Obras (CPP separado por GPS)
_ANEXO_IV = [
    (180_000,    0.045, 0),
    (360_000,    0.090, 8_100),
    (720_000,    0.102, 12_420),
    (1_800_000,  0.140, 39_780),
    (3_600_000,  0.220, 183_780),
    (4_800_000,  0.330, 828_000),
]

# Anexo V — Serviços intelectuais/técnicos (TI, engenharia, saúde, contabilidade etc.)
_ANEXO_V = [
    (180_000,    0.155, 0),
    (360_000,    0.180, 4_500),
    (720_000,    0.195, 9_900),
    (1_800_000,  0.205, 17_100),
    (3_600_000,  0.230, 62_100),
    (4_800_000,  0.305, 540_000),
]

_TABELAS = {
    "I":   _ANEXO_I,
    "II":  _ANEXO_II,
    "III": _ANEXO_III,
    "IV":  _ANEXO_IV,
    "V":   _ANEXO_V,
}

# Limites MEI
_LIMITE_MEI = 81_000.0

# Salário mínimo 2026 para cálculo do DAS-MEI
_SALARIO_MINIMO_2026 = 1_621.0

# Fator R: folha/RBT12 ≥ 28% → Anexo III; < 28% → Anexo V
FATOR_R_THRESHOLD = 0.28


def _aliq_efetiva(rbt12: float, tabela: list) -> tuple[float, str]:
    """
    Calcula a alíquota efetiva do Simples Nacional pela fórmula correta:
        (RBT12 × Alíq.Nominal − Parcela a Deduzir) / RBT12

    Retorna (alíquota_efetiva, descrição_da_faixa).
    """
    for limite, aliq_nom, pd in tabela:
        if rbt12 <= limite:
            efetiva = (rbt12 * aliq_nom - pd) / rbt12
            return round(max(efetiva, 0.0), 6), (
                f"Alíq. nominal {aliq_nom*100:.1f}%, "
                f"parcela a deduzir R$ {pd:,.0f}, "
                f"alíq. efetiva {efetiva*100:.2f}%"
            )
    # Última faixa
    aliq_nom, pd = tabela[-1][1], tabela[-1][2]
    efetiva = (rbt12 * aliq_nom - pd) / rbt12
    return round(max(efetiva, 0.0), 6), (
        f"Última faixa — alíq. nominal {aliq_nom*100:.1f}%, "
        f"parcela a deduzir R$ {pd:,.0f}, "
        f"alíq. efetiva {efetiva*100:.2f}%"
    )


def calcular_fator_r(folha_mensal_12m: float, rbt12: float) -> float:
    """Fator R = (folha de salários dos últimos 12 meses) / RBT12."""
    if rbt12 <= 0:
        return 0.0
    return round(folha_mensal_12m / rbt12, 4)


def get_aliquota_simples(
    setor: dict,
    faturamento_anual: float | None,
    folha_pagamento_mensal: float | None = None,
) -> tuple[float, str, str | None]:
    """
    Retorna (alíquota_efetiva, base_legal_descricao, aviso_extra | None).

    Lógica de seleção do Anexo:
    - anexo_simples "I"       → Anexo I (Comércio)
    - anexo_simples "II"      → Anexo II (Indústria)
    - anexo_simples "III"     → Anexo III (Serviços gerais)
    - anexo_simples "IV"      → Anexo IV (Construção/Limpeza/Vigilância — CPP SEPARADO via GPS)
    - anexo_simples "V"       → Anexo V (Serviços intelectuais)
    - anexo_simples "FATOR_R" → Fator R decide III vs V
                                 Se folha informada: usa o Anexo correto
                                 Se não informada: usa Anexo V (conservador) + aviso
    """
    fat = faturamento_anual or 360_000.0
    anexo_id = setor.get("anexo_simples", "III")

    aviso: str | None = None

    if anexo_id == "FATOR_R":
        if folha_pagamento_mensal is not None:
            folha_12m = folha_pagamento_mensal * 12
            fr = calcular_fator_r(folha_12m, fat)
            if fr >= FATOR_R_THRESHOLD:
                tabela = _ANEXO_III
                nome_anexo = "III"
                aviso = f"Fator R = {fr*100:.1f}% ≥ 28% → Anexo III aplicável."
            else:
                tabela = _ANEXO_V
                nome_anexo = "V"
                folha_min = fat * FATOR_R_THRESHOLD / 12
                aviso = (
                    f"Fator R = {fr*100:.1f}% < 28% → Anexo V aplicável. "
                    f"Para usar Anexo III, a folha mensal precisaria ser ≥ R$ {folha_min:,.0f}."
                )
        else:
            # Sem folha informada: usar Anexo V (conservador)
            tabela = _ANEXO_V
            nome_anexo = "V"
            folha_min = fat * FATOR_R_THRESHOLD / 12
            aviso = (
                "Folha de pagamento não informada. Usando Anexo V (mais conservador). "
                f"Se sua folha mensal for ≥ R$ {folha_min:,.0f}, o Fator R atingiria 28% "
                f"e o Anexo III seria aplicável (alíquota menor)."
            )
    elif anexo_id in _TABELAS:
        tabela = _TABELAS[anexo_id]
        nome_anexo = anexo_id
        if anexo_id == "IV":
            aviso = (
                "Atenção (Anexo IV): o CPP (Contribuição Patronal Previdenciária) NÃO está "
                "incluso no DAS e deve ser recolhido separadamente via GPS, à alíquota de 20% "
                "sobre a folha de pagamento."
            )
    else:
        # Fallback para Anexo III
        tabela = _ANEXO_III
        nome_anexo = "III"

    aliq, descricao = _aliq_efetiva(fat, tabela)
    base_legal = (
        f"LC 123/2006, Anexo {nome_anexo} — {descricao}"
    )
    return aliq, base_legal, aviso


def get_aliquota_simples_por_anexo(
    faturamento_anual: float,
    anexo_id: str,
) -> tuple[float, str]:
    """
    Retorna (alíquota_efetiva, descrição_faixa) para um Anexo específico.
    Usado internamente para calcular ambos os cenários do Fator R.
    """
    tabela = _TABELAS.get(anexo_id, _ANEXO_III)
    return _aliq_efetiva(faturamento_anual, tabela)


def get_mei_das_mensal(setor: dict) -> float:
    """
    DAS fixo mensal do MEI:
      - INSS: 5% do salário mínimo
      - ICMS (produto): R$ 1,00
      - ISS (serviço): R$ 5,00
    """
    inss = _SALARIO_MINIMO_2026 * 0.05   # R$ 75,90
    tipo = setor.get("tipo", "servico")
    adicional = 1.0 if tipo == "produto" else 5.0
    return round(inss + adicional, 2)


def get_mei_aliquota_efetiva(setor: dict, faturamento_anual: float | None) -> float:
    """Alíquota efetiva MEI = (DAS mensal × 12) / faturamento anual."""
    das_mensal = get_mei_das_mensal(setor)
    fat = faturamento_anual or (_LIMITE_MEI / 2)  # default: metade do teto MEI
    aliq = (das_mensal * 12) / fat
    return round(aliq, 6)


def validar_mei(setor: dict, faturamento_anual: float | None) -> tuple[bool, str | None]:
    """
    Verifica se a atividade pode se enquadrar no regime MEI.
    Retorna (permitido: bool, motivo_bloqueio: str | None).
    """
    if not setor.get("mei_permitido", True):
        restricao = setor.get("mei_restricao", "atividade_vedada")
        conselho = setor.get("mei_conselho")

        if restricao == "profissao_regulamentada" and conselho:
            return False, (
                f"Profissão regulamentada pelo {conselho} — MEI é expressamente vedado para "
                f"esta atividade. Os profissionais devem se registrar como autônomos (RPA) "
                f"ou constituir pessoa jurídica em outro regime. (LC 128/2008, Art. 18-A, § 4º)"
            )
        elif restricao == "profissao_regulamentada":
            return False, (
                "Profissão intelectual/técnica regulamentada — MEI não é permitido para esta "
                "atividade conforme CGSN 140/2018 e LC 128/2008, Art. 18-A, § 4º, inciso XI."
            )
        elif restricao == "escala_industrial":
            return False, (
                "Esta atividade requer escala operacional incompatível com o regime MEI "
                "(estrutura industrial, equipamentos, alvará específico). MEI não é permitido."
            )
        elif restricao == "atividade_vedada":
            return False, (
                "Esta atividade não consta na lista de atividades permitidas para MEI "
                "conforme CGSN 140/2018 e LC 123/2006, Art. 18-A, § 4º."
            )
        else:
            return False, (
                "MEI não permitido para esta atividade (CGSN 140/2018)."
            )

    # Verifica limite de faturamento
    if faturamento_anual is not None and faturamento_anual > _LIMITE_MEI:
        return False, (
            f"Faturamento anual informado (R$ {faturamento_anual:,.0f}) excede o limite MEI "
            f"de R$ {_LIMITE_MEI:,.0f}/ano. Acima desse limite o MEI é automaticamente "
            f"desenquadrado. (LC 123/2006, Art. 18-A, § 1º)"
        )

    return True, None


def get_iss_padrao(setor: dict) -> float:
    return setor.get("iss_padrao") or 0.03
