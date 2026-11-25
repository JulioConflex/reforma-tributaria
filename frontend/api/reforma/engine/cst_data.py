"""
Tabela de CST e cClassTrib para CBS e IBS — LC 214/2025.
"""

CST_CBS_IBS: list[dict] = [
    {
        "codigo": "00",
        "nome": "Tributado integralmente",
        "descricao": "Operação sujeita integralmente às alíquotas de referência de CBS e IBS, sem qualquer redução ou benefício.",
        "quando_usar": "Regra geral para produtos e serviços sem benefício fiscal específico.",
        "gera_credito": True,
    },
    {
        "codigo": "10",
        "nome": "Tributado com redução — transição",
        "descricao": "Redução transitória de base de cálculo aplicável durante o período de migração (2026-2032). Alíquota efetiva reduzida proporcionalmente ao ano-calendário.",
        "quando_usar": "Operações em setores cujas alíquotas ainda estão sendo implementadas gradualmente.",
        "gera_credito": True,
    },
    {
        "codigo": "20",
        "nome": "Tributado com redução de 60%",
        "descricao": "Redução de 60% na alíquota para setores específicos da LC 214/2025: saúde, educação, transporte coletivo de passageiros, agropecuária, insumos agropecuários e atividades culturais.",
        "quando_usar": "Produtos e serviços de saúde, educação, insumos agropecuários, transporte coletivo, medicamentos e atividades culturais.",
        "gera_credito": True,
    },
    {
        "codigo": "30",
        "nome": "Alíquota zero — Cesta Básica Nacional",
        "descricao": "Redução de 100% aplicada a produtos da Cesta Básica Nacional (CBN) conforme lista definida em lei: carnes, peixes, ovos, leite, arroz, feijão, trigo, sal, óleo, massas, café, etc.",
        "quando_usar": "Alimentos essenciais incluídos na Cesta Básica Nacional (CBN).",
        "gera_credito": False,
    },
    {
        "codigo": "40",
        "nome": "Isento — outros casos",
        "descricao": "Isenção de CBS/IBS prevista em lei específica fora da Cesta Básica Nacional, como benefícios regionais (Zona Franca de Manaus) ou setoriais.",
        "quando_usar": "Operações com isenção legal específica (ex.: produtos industrializados na ZFM).",
        "gera_credito": False,
    },
    {
        "codigo": "50",
        "nome": "Imune",
        "descricao": "Imunidade constitucional: exportações de bens e serviços para o exterior; livros, jornais e periódicos; operações com templos, partidos políticos, sindicatos e entidades educacionais e assistenciais sem fins lucrativos.",
        "quando_usar": "Exportações, livros e publicações periódicas, operações com entes imunes.",
        "gera_credito": False,
    },
    {
        "codigo": "60",
        "nome": "Suspensão",
        "descricao": "Suspensão temporária de CBS/IBS mediante regime específico autorizado pela administração tributária.",
        "quando_usar": "Importações e saídas para o exterior via drawback; regimes aduaneiros especiais; armazéns gerais.",
        "gera_credito": False,
    },
    {
        "codigo": "70",
        "nome": "Diferimento",
        "descricao": "O recolhimento é transferido para etapa posterior da cadeia produtiva. O adquirente assume o débito.",
        "quando_usar": "Produtor rural pessoa física, cooperativas agropecuárias, e outros casos previstos em regulamento.",
        "gera_credito": True,
    },
    {
        "codigo": "80",
        "nome": "Substituição tributária — retida pelo substituto",
        "descricao": "O imposto foi retido e recolhido pelo substituto tributário a montante da cadeia; o substituído está liberado do recolhimento.",
        "quando_usar": "Substituídos tributários em operações com CBS/IBS retido na fonte pelo fabricante ou importador.",
        "gera_credito": True,
    },
    {
        "codigo": "90",
        "nome": "Regime específico",
        "descricao": "Tributação por regime especial previsto em lei: serviços financeiros (Arts. 193-212 LC 214), seguros, operações imobiliárias (Arts. 213-233), planos de saúde ANS (Arts. 234-238), loterias.",
        "quando_usar": "Instituições financeiras, seguradoras, administradoras de imóveis, operadoras de planos de saúde e assemelhadas.",
        "gera_credito": True,
    },
]

CCLASS_TRIB: list[dict] = [
    {
        "codigo": "00",
        "nome": "Contribuinte geral (regime regular)",
        "descricao": "Pessoa jurídica contribuinte de CBS e IBS no regime regular (Lucro Presumido ou Lucro Real).",
        "credito": "Pode tomar crédito integral de CBS e IBS sobre todas as entradas tributadas.",
    },
    {
        "codigo": "01",
        "nome": "Simples Nacional / MEI",
        "descricao": "Optante pelo Simples Nacional ou Microempreendedor Individual (MEI).",
        "credito": "Crédito restrito: apenas CBS proporcional (regime de crédito presumido do Simples). Não há crédito de IBS.",
    },
    {
        "codigo": "02",
        "nome": "Imune",
        "descricao": "Entidade com imunidade constitucional: templos de qualquer culto, partidos políticos, sindicatos, entidades educacionais e assistenciais sem fins lucrativos.",
        "credito": "Sem direito a crédito de CBS/IBS (operações imunes).",
    },
    {
        "codigo": "03",
        "nome": "Isento",
        "descricao": "Pessoa jurídica com isenção concedida por lei específica.",
        "credito": "Sem direito a crédito de CBS/IBS nas operações isentas.",
    },
]
