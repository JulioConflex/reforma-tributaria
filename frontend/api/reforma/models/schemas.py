from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class RegimeTributario(str, Enum):
    simples_nacional = "simples_nacional"
    lucro_presumido = "lucro_presumido"
    lucro_real = "lucro_real"
    mei = "mei"


class TipoOperacao(str, Enum):
    produto = "produto"
    servico = "servico"


class SimulacaoInput(BaseModel):
    valor: float = Field(..., ge=0, description="Valor da operação em R$ (0 = simulação zerada)")
    regime: RegimeTributario
    setor_id: str = Field(..., description="ID do setor (ver /setores)")
    uf: str = Field(default="SP", min_length=2, max_length=2, description="UF de destino (para ICMS)")
    ano: int = Field(default=2026, ge=2026, le=2033, description="Ano da simulação")
    percentual_credito_entrada: float = Field(
        default=0.4, ge=0.0, le=1.0,
        description="% do CBS/IBS que pode ser abatido via créditos de entradas (0 a 1). Padrão: 40%."
    )
    faturamento_anual: Optional[float] = Field(
        default=None, gt=0,
        description="Faturamento anual em R$ (necessário para Simples Nacional)"
    )
    folha_pagamento_mensal: Optional[float] = Field(
        default=None, gt=0,
        description=(
            "Folha de pagamento média mensal em R$ (últimos 12 meses). "
            "Necessário para calcular o Fator R em serviços intelectuais/técnicos "
            "(TI, contabilidade, engenharia, saúde, advocacia etc.). "
            "Fator R = (folha × 12) / faturamento_anual. "
            "Fator R ≥ 28% → Anexo III; < 28% → Anexo V."
        )
    )
    faturamento_mensal: Optional[float] = Field(
        default=None, gt=0,
        description=(
            "Faturamento (receita) médio mensal em R$. Usado no Lucro Real para "
            "estimar o lucro (receita − despesas) e o IRPJ/CSLL."
        )
    )
    despesas_mensais: Optional[float] = Field(
        default=None, gt=0,
        description=(
            "Despesas dedutíveis médias mensais em R$. Usado no Lucro Real para "
            "estimar o lucro real e, consequentemente, o IRPJ/CSLL."
        )
    )
    aliquota_iss: Optional[float] = Field(
        default=None, ge=0.0, le=0.05,
        description=(
            "Alíquota municipal do ISS (0 a 5%). Quando informada, substitui o padrão do setor. "
            "Aplicável apenas a serviços no Lucro Presumido, Lucro Real e MEI. "
            "No Simples Nacional o ISS já está embutido no DAS."
        )
    )
    pis_cofins_regime: Optional[str] = Field(
        default=None,
        description=(
            "'cumulativo' | 'nao_cumulativo'. Quando None, deriva do regime fiscal: "
            "Lucro Presumido → cumulativo (0,65%+3%); Lucro Real → não-cumulativo (1,65%+7,6%). "
            "Use 'cumulativo' para entidades financeiras e equiparadas no Lucro Real "
            "(Lei 9.718/98, Art. 14 — excluídas do regime não-cumulativo)."
        )
    )


class DetalheTributo(BaseModel):
    nome: str
    aliquota_aplicada: float
    valor: float
    base_legal: str
    formula: Optional[str] = None  # memória de cálculo: como o valor foi obtido
    informativo: bool = False      # True = exibido mas NÃO somado ao total (ex.: CBS/IBS simbólicos em 2026)


class ResultadoSistema(BaseModel):
    total: float
    percentual_sobre_valor: float
    detalhes: list[DetalheTributo]


class RecomendacaoItem(BaseModel):
    titulo: str
    texto: str
    icone: str
    prioridade: str  # "alta", "media", "baixa"


class CenarioFatorR(BaseModel):
    anexo: str
    aliquota_efetiva: float
    total: float
    percentual_sobre_valor: float


class FatorRInfo(BaseModel):
    aplicavel: bool
    fator_r_calculado: Optional[float] = None   # None se folha não informada
    anexo_usado: str                             # "III", "V", "V (conservador)"
    cenario_iii: Optional[CenarioFatorR] = None
    cenario_v: Optional[CenarioFatorR] = None
    folha_minima_para_iii: Optional[float] = None  # folha mensal mínima para Fator R ≥ 28%
    mensagem: str


class IrpjCsllInfo(BaseModel):
    """Informação sobre IRPJ/CSLL — tributos sobre lucro não incluídos na simulação."""
    incluido_no_das: bool = False        # True para Simples Nacional e MEI
    estimavel: bool = False              # True apenas para Lucro Presumido
    irpj_estimado: Optional[float] = None       # R$ sobre a operação simulada
    csll_estimado: Optional[float] = None
    irpj_percentual: Optional[float] = None     # % sobre o valor da operação
    csll_percentual: Optional[float] = None
    adicional_irpj_possivel: bool = False       # Adicional 10% IRPJ se lucro > R$ 20k/mês
    mensagem_leigo: str = ""


class SimulacaoOutput(BaseModel):
    valor_operacao: float
    regime: str
    setor_nome: str
    ano: int
    uf: str
    sistema_atual: ResultadoSistema
    sistema_novo: ResultadoSistema
    economia_ou_acrescimo: float
    economia_percentual: float
    reducao_setor_aplicada: float
    is_aplicavel: bool
    descricao_ano: str
    alerta: Optional[str] = None
    narrativa: str = ""
    recomendacoes: list[RecomendacaoItem] = []
    fator_r_info: Optional[FatorRInfo] = None
    mei_incompativel: bool = False
    mei_motivo: Optional[str] = None
    irpj_csll_info: Optional[IrpjCsllInfo] = None


class ProjecaoAnual(BaseModel):
    ano: int
    descricao: str
    total_sistema_novo: float
    percentual_sobre_valor: float
    total_sistema_atual: float
    diferenca: float


class SimplesNacionalComparativo(BaseModel):
    """Comparativo entre Simples Normal e por fora (IBS/CBS separados do DAS)."""
    sistema_novo_por_fora: ResultadoSistema
    total_normal: float
    total_por_fora: float
    diferenca_custo: float           # por_fora − normal; positivo = mais caro para a empresa
    credito_cliente_normal: float    # R$ de IBS/CBS que o comprador B2B aproveita (Simples Normal)
    credito_cliente_por_fora: float  # R$ de IBS/CBS que o comprador B2B aproveita (por fora)
    aviso: str
    quando_b2c: str
    quando_b2b: str


class PassoMemoria(BaseModel):
    """Um passo da memória de cálculo (rótulo + fórmula textual + valor)."""
    rotulo: str
    formula: str
    valor: float


class MemoriaCalculo(BaseModel):
    """Premissas e fatores usados na simulação, para auditoria pelo usuário."""
    # Premissas
    valor_operacao: float
    regime: str
    setor_nome: str
    uf: str
    ano: int
    percentual_credito_entrada: float
    faturamento_mensal: Optional[float] = None
    despesas_mensais: Optional[float] = None
    # Fatores aplicados (do setor e do cronograma do ano)
    reducao_setor: float          # 0..1 (redução setorial de IBS/CBS)
    aliquota_icms_uf: float        # alíquota de ICMS da UF
    iss_setor: float               # alíquota de ISS do setor (serviços)
    cbs_percentual: float          # alíquota de referência da CBS no ano
    ibs_percentual: float          # alíquota de referência do IBS no ano
    icms_fator: float              # fração de ICMS vigente no ano (transição)
    iss_fator: float               # fração de ISS vigente no ano (transição)
    pis_cofins_ativo: bool         # se PIS/COFINS ainda vigoram no ano
    # Passos de IRPJ/CSLL (quando estimável — Lucro Real com despesas)
    passos_irpj_csll: list[PassoMemoria] = []
    observacoes: list[str] = []


class SimulacaoComProjecaoOutput(SimulacaoOutput):
    projecao_2026_2033: list[ProjecaoAnual]
    memoria_calculo: Optional[MemoriaCalculo] = None
    simples_por_fora: Optional[SimplesNacionalComparativo] = None


class MarkupInput(BaseModel):
    custo: float = Field(..., ge=0, description="Custo do produto/serviço em R$ (0 = zerado)")
    margem_desejada: float = Field(..., gt=0, lt=1, description="Margem de lucro desejada (ex: 0.30 = 30%)")
    despesas_fixas_percentual: float = Field(
        default=0.1, ge=0.0, lt=1.0,
        description="Despesas fixas como % do faturamento (ex: 0.10 = 10%)"
    )
    regime: RegimeTributario
    setor_id: str
    uf: str = Field(default="SP")
    ano: int = Field(default=2026, ge=2026, le=2033)
    percentual_credito_entrada: float = Field(default=0.4, ge=0.0, le=1.0)
    pis_cofins_regime: Optional[str] = Field(default=None, description="'cumulativo' | 'nao_cumulativo'")


class MarkupOutput(BaseModel):
    custo: float
    margem_desejada: float
    despesas_fixas_percentual: float
    preco_venda_sistema_atual: float
    preco_venda_sistema_novo: float
    diferenca_preco: float
    markup_atual: float
    markup_novo: float
    carga_tributaria_atual_percentual: float
    carga_tributaria_nova_percentual: float
    aliquota_efetiva_nova: float
    obs_split_payment: str
    detalhes_atual: list[DetalheTributo] = []
    detalhes_novo: list[DetalheTributo] = []
    aviso_impossivel: bool = False
    soma_sem_tributos: float = 0.0   # margem% + despesas% (para mostrar no aviso)
