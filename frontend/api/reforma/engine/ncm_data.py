"""
Mapeamento de capítulos NCM/NBS para categorias tributárias (LC 214/2025).
Cobertura: 96 capítulos da NCM + categorias para CBS, IBS e IS.
"""

CBS_REFERENCIA = 0.088   # 8,8% (referência 2033)
IBS_REFERENCIA = 0.177   # 17,7% (soma estado + município, SP referência)

CATEGORIAS: dict[str, dict] = {
    "INTEGRAL": {
        "nome": "Tributado integralmente",
        "descricao": "Alíquota padrão CBS + IBS, sem redução.",
        "reducao_pct": 0.0,
        "cst": "00",
        "is_aliquota": 0.0,
        "is_descricao": None,
    },
    "REDUZIDO_60": {
        "nome": "Redução setorial 60%",
        "descricao": "Setores com 60% de redução: saúde, educação, agropecuária, transporte coletivo, atividades culturais.",
        "reducao_pct": 0.60,
        "cst": "20",
        "is_aliquota": 0.0,
        "is_descricao": None,
    },
    "ISENTO_CBN": {
        "nome": "Cesta Básica Nacional — alíquota zero",
        "descricao": "Produtos da Cesta Básica Nacional (CBN) com redução de 100%.",
        "reducao_pct": 1.0,
        "cst": "30",
        "is_aliquota": 0.0,
        "is_descricao": None,
    },
    "IS_ALCOOL": {
        "nome": "Tributado + IS bebidas alcoólicas",
        "descricao": "CBS + IBS integrais + Imposto Seletivo sobre bebidas alcoólicas (Art. 395 LC 214). Itens não alcoólicos do capítulo (água, sucos) não têm IS.",
        "reducao_pct": 0.0,
        "cst": "00",
        "is_aliquota": 0.20,
        "is_descricao": "IS bebidas alcoólicas (estimativa 20% — sujeito a regulamentação)",
    },
    "IS_TABACO": {
        "nome": "Tributado + IS tabaco",
        "descricao": "CBS + IBS integrais + Imposto Seletivo sobre produtos do fumo (Art. 395 LC 214).",
        "reducao_pct": 0.0,
        "cst": "00",
        "is_aliquota": 0.15,
        "is_descricao": "IS tabaco (estimativa 15% — sujeito a regulamentação)",
    },
    "IS_VEICULO": {
        "nome": "Tributado + IS veículos",
        "descricao": "CBS + IBS integrais + IS sobre veículos de passeio (motor a combustão interna). Veículos elétricos têm tratamento diferenciado.",
        "reducao_pct": 0.0,
        "cst": "00",
        "is_aliquota": 0.10,
        "is_descricao": "IS veículos de passeio (estimativa 10%)",
    },
    "IS_MINERAL": {
        "nome": "Tributado + IS extração mineral",
        "descricao": "CBS + IBS integrais + IS de 1% sobre extração de recursos naturais (Art. 404 LC 214).",
        "reducao_pct": 0.0,
        "cst": "00",
        "is_aliquota": 0.01,
        "is_descricao": "IS minérios — 1% (Art. 404 LC 214)",
    },
    "AGRO_INPUT": {
        "nome": "Insumo agropecuário — redução 60%",
        "descricao": "Defensivos, sementes, fertilizantes, rações e insumos para produção agropecuária.",
        "reducao_pct": 0.60,
        "cst": "20",
        "is_aliquota": 0.0,
        "is_descricao": None,
    },
    "IMUNE": {
        "nome": "Imune",
        "descricao": "Imunidade constitucional: livros, jornais, periódicos; exportações; operações com templos/partidos/sindicatos.",
        "reducao_pct": 1.0,
        "cst": "50",
        "is_aliquota": 0.0,
        "is_descricao": None,
    },
}

# Capítulos NCM: chave = 2 dígitos (string), valor = {descricao, categoria}
CAPITULOS: dict[str, dict] = {
    # Seção I — Animais vivos e produtos do reino animal
    "01": {"descricao": "Animais vivos", "categoria": "REDUZIDO_60"},
    "02": {"descricao": "Carnes e miudezas comestíveis", "categoria": "ISENTO_CBN"},
    "03": {"descricao": "Peixes, crustáceos e moluscos", "categoria": "ISENTO_CBN"},
    "04": {"descricao": "Leite, ovos, mel e produtos de origem animal", "categoria": "ISENTO_CBN"},
    "05": {"descricao": "Produtos de origem animal (outros)", "categoria": "INTEGRAL"},
    # Seção II — Produtos do reino vegetal
    "06": {"descricao": "Plantas vivas e produtos de floricultura", "categoria": "INTEGRAL"},
    "07": {"descricao": "Produtos hortícolas (legumes, tubérculos)", "categoria": "ISENTO_CBN"},
    "08": {"descricao": "Frutas e cascas de frutas cítricas", "categoria": "ISENTO_CBN"},
    "09": {"descricao": "Café, chá, mate e especiarias", "categoria": "ISENTO_CBN"},
    "10": {"descricao": "Cereais (trigo, milho, arroz, etc.)", "categoria": "ISENTO_CBN"},
    "11": {"descricao": "Farinhas, amidos e féculas de cereais", "categoria": "ISENTO_CBN"},
    "12": {"descricao": "Sementes e frutos oleaginosos", "categoria": "REDUZIDO_60"},
    "13": {"descricao": "Gomas, resinas e outros sucos vegetais", "categoria": "INTEGRAL"},
    "14": {"descricao": "Matérias para entrançar e outros produtos vegetais", "categoria": "INTEGRAL"},
    # Seção III — Gorduras e óleos
    "15": {"descricao": "Gorduras e óleos animais/vegetais (incluindo óleo de soja, girassol)", "categoria": "ISENTO_CBN"},
    # Seção IV — Preparações alimentícias
    "16": {"descricao": "Preparações de carne, peixe ou crustáceos", "categoria": "INTEGRAL"},
    "17": {"descricao": "Açúcares e produtos de confeitaria", "categoria": "ISENTO_CBN"},
    "18": {"descricao": "Cacau e suas preparações (chocolate)", "categoria": "INTEGRAL"},
    "19": {"descricao": "Preparações de cereais (pães, massas, biscoitos)", "categoria": "ISENTO_CBN"},
    "20": {"descricao": "Preparações de legumes/frutas (conservas, sucos)", "categoria": "INTEGRAL"},
    "21": {"descricao": "Preparações alimentícias diversas (molhos, caldos, sorvetes)", "categoria": "INTEGRAL"},
    "22": {"descricao": "Bebidas (água, sucos, cervejas, vinhos, destilados)", "categoria": "IS_ALCOOL"},
    "23": {"descricao": "Resíduos de indústrias alimentares, rações animais", "categoria": "AGRO_INPUT"},
    "24": {"descricao": "Tabaco e sucedâneos do tabaco", "categoria": "IS_TABACO"},
    # Seção V — Produtos minerais
    "25": {"descricao": "Sal, enxofre, terras e pedras, cimento", "categoria": "INTEGRAL"},
    "26": {"descricao": "Minérios, escórias e cinzas", "categoria": "IS_MINERAL"},
    "27": {"descricao": "Combustíveis minerais, óleos minerais (petróleo)", "categoria": "INTEGRAL"},
    # Seção VI — Produtos da indústria química
    "28": {"descricao": "Produtos químicos inorgânicos", "categoria": "INTEGRAL"},
    "29": {"descricao": "Produtos químicos orgânicos", "categoria": "INTEGRAL"},
    "30": {"descricao": "Produtos farmacêuticos (medicamentos)", "categoria": "REDUZIDO_60"},
    "31": {"descricao": "Adubos e fertilizantes", "categoria": "AGRO_INPUT"},
    "32": {"descricao": "Extratos tanantes, tintas e vernizes", "categoria": "INTEGRAL"},
    "33": {"descricao": "Perfumes, cosméticos e preparações de toucador", "categoria": "INTEGRAL"},
    "34": {"descricao": "Sabões, agentes orgânicos de superfície, ceras", "categoria": "INTEGRAL"},
    "35": {"descricao": "Matérias albuminóides, amidos modificados, colas", "categoria": "INTEGRAL"},
    "36": {"descricao": "Pólvoras, explosivos e fósforos", "categoria": "INTEGRAL"},
    "37": {"descricao": "Produtos para fotografia e cinematografia", "categoria": "INTEGRAL"},
    "38": {"descricao": "Produtos químicos diversos (saneantes, agrotóxicos)", "categoria": "INTEGRAL"},
    # Seção VII — Plásticos e borracha
    "39": {"descricao": "Plásticos e suas obras", "categoria": "INTEGRAL"},
    "40": {"descricao": "Borracha e suas obras", "categoria": "INTEGRAL"},
    # Seção VIII — Couro e peles
    "41": {"descricao": "Peles e couros", "categoria": "INTEGRAL"},
    "42": {"descricao": "Obras de couro, artigos de viagem e bolsas", "categoria": "INTEGRAL"},
    "43": {"descricao": "Peleteria (peles com pelo) e suas obras", "categoria": "INTEGRAL"},
    # Seção IX — Madeira, cortiça e cestaria
    "44": {"descricao": "Madeira, carvão vegetal e obras de madeira", "categoria": "INTEGRAL"},
    "45": {"descricao": "Cortiça e suas obras", "categoria": "INTEGRAL"},
    "46": {"descricao": "Obras de espartaria (palha, bambu, vime)", "categoria": "INTEGRAL"},
    # Seção X — Papel e cartão
    "47": {"descricao": "Pastas de madeira e papel para reciclagem", "categoria": "INTEGRAL"},
    "48": {"descricao": "Papel e cartão e suas obras", "categoria": "INTEGRAL"},
    "49": {"descricao": "Produtos da indústria gráfica, livros, jornais, periódicos", "categoria": "IMUNE"},
    # Seção XI — Matérias têxteis
    "50": {"descricao": "Seda", "categoria": "INTEGRAL"},
    "51": {"descricao": "Lã e pelos finos", "categoria": "INTEGRAL"},
    "52": {"descricao": "Algodão", "categoria": "INTEGRAL"},
    "53": {"descricao": "Outras fibras têxteis vegetais (linho, juta)", "categoria": "INTEGRAL"},
    "54": {"descricao": "Filamentos sintéticos ou artificiais", "categoria": "INTEGRAL"},
    "55": {"descricao": "Fibras sintéticas ou artificiais descontínuas", "categoria": "INTEGRAL"},
    "56": {"descricao": "Pastas, feltros e falsos tecidos", "categoria": "INTEGRAL"},
    "57": {"descricao": "Tapetes e outros revestimentos para pavimentos", "categoria": "INTEGRAL"},
    "58": {"descricao": "Tecidos especiais, tufados e rendas", "categoria": "INTEGRAL"},
    "59": {"descricao": "Tecidos impregnados, revestidos ou plastificados", "categoria": "INTEGRAL"},
    "60": {"descricao": "Tecidos de malha", "categoria": "INTEGRAL"},
    "61": {"descricao": "Vestuário e acessórios — de malha", "categoria": "INTEGRAL"},
    "62": {"descricao": "Vestuário e acessórios — exceto malha", "categoria": "INTEGRAL"},
    "63": {"descricao": "Outros artefatos têxteis, conjuntos sortidos", "categoria": "INTEGRAL"},
    # Seção XII — Calçados e chapéus
    "64": {"descricao": "Calçados, polainas e artefatos semelhantes", "categoria": "INTEGRAL"},
    "65": {"descricao": "Chapéus e artefatos de uso semelhante", "categoria": "INTEGRAL"},
    "66": {"descricao": "Guarda-chuvas, bengalas e artigos afins", "categoria": "INTEGRAL"},
    "67": {"descricao": "Penas preparadas, flores artificiais, cabelos", "categoria": "INTEGRAL"},
    # Seção XIII — Obras de pedra, cerâmica e vidro
    "68": {"descricao": "Obras de pedra, gesso, cimento e materiais similares", "categoria": "INTEGRAL"},
    "69": {"descricao": "Produtos cerâmicos (tijolos, telhas, porcelana)", "categoria": "INTEGRAL"},
    "70": {"descricao": "Vidro e obras de vidro", "categoria": "INTEGRAL"},
    # Seção XIV — Jóias e metais preciosos
    "71": {"descricao": "Pérolas, pedras preciosas, joalheria e metais preciosos", "categoria": "INTEGRAL"},
    # Seção XV — Metais comuns
    "72": {"descricao": "Ferro fundido, ferro e aço", "categoria": "INTEGRAL"},
    "73": {"descricao": "Obras de ferro fundido, ferro ou aço", "categoria": "INTEGRAL"},
    "74": {"descricao": "Cobre e suas obras", "categoria": "INTEGRAL"},
    "75": {"descricao": "Níquel e suas obras", "categoria": "INTEGRAL"},
    "76": {"descricao": "Alumínio e suas obras", "categoria": "INTEGRAL"},
    "78": {"descricao": "Chumbo e suas obras", "categoria": "INTEGRAL"},
    "79": {"descricao": "Zinco e suas obras", "categoria": "INTEGRAL"},
    "80": {"descricao": "Estanho e suas obras", "categoria": "INTEGRAL"},
    "81": {"descricao": "Outros metais comuns; metal cermet e obras", "categoria": "INTEGRAL"},
    "82": {"descricao": "Ferramentas e cutelaria de metais comuns", "categoria": "INTEGRAL"},
    "83": {"descricao": "Obras diversas de metais comuns", "categoria": "INTEGRAL"},
    # Seção XVI — Máquinas e equipamentos
    "84": {"descricao": "Máquinas, reatores nucleares, caldeiras, equipamentos mecânicos", "categoria": "INTEGRAL"},
    "85": {"descricao": "Máquinas e aparelhos elétricos e eletrônicos", "categoria": "INTEGRAL"},
    # Seção XVII — Material de transporte
    "86": {"descricao": "Veículos e material para ferrovias, bondes", "categoria": "INTEGRAL"},
    "87": {"descricao": "Veículos automóveis, tratores e ciclos (incluindo automóveis de passeio)", "categoria": "IS_VEICULO"},
    "88": {"descricao": "Aeronaves e aparelhos espaciais", "categoria": "INTEGRAL"},
    "89": {"descricao": "Embarcações e estruturas flutuantes", "categoria": "INTEGRAL"},
    # Seção XVIII — Instrumentos de precisão
    "90": {"descricao": "Instrumentos ópticos, fotográficos, médicos e de medida", "categoria": "INTEGRAL"},
    "91": {"descricao": "Aparelhos de relojoaria", "categoria": "INTEGRAL"},
    "92": {"descricao": "Instrumentos musicais", "categoria": "INTEGRAL"},
    # Seção XIX — Armas e munições
    "93": {"descricao": "Armas, munições e suas partes e acessórios", "categoria": "INTEGRAL"},
    # Seção XX — Diversas
    "94": {"descricao": "Móveis, iluminação, construção pré-fabricada e colchões", "categoria": "INTEGRAL"},
    "95": {"descricao": "Brinquedos, jogos, artigos esportivos e suas partes", "categoria": "INTEGRAL"},
    "96": {"descricao": "Obras diversas (esferográficas, pentes, vassouras, etc.)", "categoria": "INTEGRAL"},
    # Seção XXI — Arte e antiguidades
    "97": {"descricao": "Objetos de arte, coleções e antiguidades", "categoria": "INTEGRAL"},
}


def buscar_ncm(codigo: str) -> dict:
    """Retorna dados tributários para um código NCM/NBS (2 a 10 dígitos)."""
    codigo = codigo.replace(".", "").replace("-", "").strip()

    if len(codigo) < 2:
        return {"erro": "Código NCM inválido (mínimo 2 dígitos)."}

    capitulo = codigo[:2].zfill(2)
    dados_cap = CAPITULOS.get(capitulo)

    if not dados_cap:
        return {
            "codigo": codigo,
            "capitulo": capitulo,
            "encontrado": False,
            "mensagem": f"Capítulo {capitulo} não mapeado. Consulte a Tabela NCM da Receita Federal.",
        }

    cat_key = dados_cap["categoria"]
    cat = CATEGORIAS[cat_key]

    cbs_efetiva = CBS_REFERENCIA * (1 - cat["reducao_pct"])
    ibs_efetiva = IBS_REFERENCIA * (1 - cat["reducao_pct"])
    total_efetivo = cbs_efetiva + ibs_efetiva + cat["is_aliquota"]

    return {
        "codigo": codigo,
        "capitulo": capitulo,
        "encontrado": True,
        "descricao_capitulo": dados_cap["descricao"],
        "categoria": cat_key,
        "categoria_nome": cat["nome"],
        "categoria_descricao": cat["descricao"],
        "reducao_pct": cat["reducao_pct"] * 100,
        "cbs_referencia": CBS_REFERENCIA * 100,
        "ibs_referencia": IBS_REFERENCIA * 100,
        "cbs_efetiva": round(cbs_efetiva * 100, 4),
        "ibs_efetiva": round(ibs_efetiva * 100, 4),
        "is_aliquota": cat["is_aliquota"] * 100,
        "is_descricao": cat["is_descricao"],
        "total_efetivo": round(total_efetivo * 100, 4),
        "cst_sugerido": cat["cst"],
        "observacao": (
            "Alíquotas de referência plenas (2033). "
            "Sujeitas a ajuste por lei complementar de cada ente federativo. "
            "Taxas transitórias se aplicam de 2026 a 2032."
        ),
    }
