"""
Assistente offline da Reforma Tributária.

Responde a partir do GLOSSÁRIO + intents curados (ancorados na LC 214/2025 e
LC 227/2026) + dados de setores. NÃO usa IA generativa — portanto não inventa:
quando não encontra correspondência, orienta o usuário em vez de "chutar".
"""
import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

_BASE = Path(__file__).parent.parent.parent / "dados"

_DISCLAIMER = "_Resposta informativa, baseada na legislação. Para decisões, confirme com seu contador._"

_SUGESTOES = [
    "O que é o IBS?",
    "Quando a reforma entra em vigor?",
    "Qual a alíquota do novo sistema?",
    "Meu setor tem redução?",
    "O que é Split Payment?",
]

_STOP = {
    "o", "a", "os", "as", "de", "do", "da", "e", "em", "um", "uma", "que", "qual",
    "quais", "como", "quando", "para", "por", "no", "na", "com", "sobre", "meu",
    "minha", "meus", "minhas", "sou", "tem", "ter", "ser", "vai", "se", "ao", "aos",
    "das", "dos", "ou", "quem", "onde", "isso", "esse", "essa", "este", "esta",
    "ele", "ela", "eu", "tao", "the", "qto", "pra", "pro", "ja", "la",
}


@lru_cache(maxsize=1)
def _load(nome: str) -> dict:
    with open(_BASE / f"{nome}.json", encoding="utf-8") as f:
        return json.load(f)


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]", " ", s)


def _tokens(s: str) -> list[str]:
    return [t for t in _norm(s).split() if len(t) > 1 and t not in _STOP]


# ── Intents curados (ancorados na lei) ────────────────────────────────────────
def _intents() -> list[dict]:
    return [
        {
            "titulo": "Cronograma / vigência",
            "kw": _tokens("quando comeca inicio vigencia vigor cronograma transicao prazo fases 2026 2027 2029 2033"),
            "resposta": (
                "A transição é gradual:\n"
                "**2026** — fase de teste (CBS 0,9% + IBS 0,1%), sem impacto real.\n"
                "**2027** — CBS entra em alíquota cheia; PIS e COFINS são extintos; o IS começa.\n"
                "**2029–2032** — o IBS sobe (10% → 20% → 30% → 40%) e o ICMS/ISS caem na mesma proporção.\n"
                "**2033** — sistema novo pleno (IBS + CBS); ICMS e ISS extintos."
            ),
            "fontes": ["LC 214/2025, Arts. 343–347, 501 e 508"],
        },
        {
            "titulo": "Alíquota de referência",
            "kw": _tokens("aliquota aliquotas referencia total percentual carga quanto paga imposto porcentagem"),
            "resposta": (
                "A alíquota de referência combinada do IVA Dual é estimada em **~26,5%** "
                "(**CBS ~8,8%** + **IBS ~17,7%**). É **provisória** — depende de Resolução do Senado. "
                "Com os créditos das compras e as reduções por setor, a carga efetiva costuma ser menor. "
                "Use o **Simulador** para ver o valor no seu caso."
            ),
            "fontes": ["LC 214/2025; estimativa do governo (teto de 26,5%)"],
        },
        {
            "titulo": "Reduções por setor",
            "kw": _tokens("reducao beneficio desconto setor reduzido isencao aliquota zero reduzida"),
            "resposta": (
                "As reduções de IBS/CBS dependem do setor:\n"
                "**60%** — saúde, educação, medicamentos e dispositivos médicos, agro, higiene básica, "
                "cultura/esporte (Arts. 128–138).\n"
                "**30%** — profissões regulamentadas do Art. 127 (advogados, contadores, engenheiros, "
                "administradores, economistas, veterinários, etc.).\n"
                "**40%** — bares e restaurantes (Arts. 273–276).\n"
                "**Alíquota zero** — cesta básica e medicamentos essenciais (Art. 146).\n"
                "Selecione seu setor no **Simulador** para ver o efeito."
            ),
            "fontes": ["LC 214/2025, Arts. 127, 128–138, 146, 273–276"],
        },
        {
            "titulo": "Melhor regime tributário",
            "kw": _tokens("melhor regime mudar trocar vale pena escolher comparar simples lucro real presumido devo"),
            "resposta": (
                "Depende do faturamento, do setor e das despesas. Use a aba **Comparador**: ela mostra "
                "os 4 regimes lado a lado já com a **carga total** (incluindo IRPJ/CSLL). "
                "Em geral, o Simples tende a ser melhor para faturamentos menores; o Lucro Real, quando há "
                "muitas despesas dedutíveis e insumos que geram crédito."
            ),
            "fontes": ["Use o Comparador do sistema"],
        },
        {
            "titulo": "IRPJ e CSLL",
            "kw": _tokens("irpj csll lucro liquido imposto renda contribuicao social"),
            "resposta": (
                "A reforma **não altera** o IRPJ e a CSLL — eles continuam incidindo sobre o **lucro**, "
                "à parte do IBS/CBS. No Simples e no MEI já estão embutidos no DAS. No **Lucro Real**, "
                "informe o faturamento e as despesas médias mensais no Simulador para estimá-los."
            ),
            "fontes": ["IRPJ: Lei 9.430/1996; CSLL: Lei 7.689/1988"],
        },
        {
            "titulo": "Bares e restaurantes",
            "kw": _tokens("restaurante restaurantes bar bares lanchonete alimentacao comida"),
            "resposta": (
                "Bares, restaurantes e lanchonetes têm **regime específico**: **redução de 40%** nas "
                "alíquotas de IBS/CBS, em regime **cumulativo** (sem crédito sobre insumos). A base de "
                "cálculo é o fornecimento de alimentação e bebidas (exclui gorjeta, entrega e app)."
            ),
            "fontes": ["LC 214/2025, Arts. 273–276"],
        },
        {
            "titulo": "Crédito de entrada / não-cumulatividade",
            "kw": _tokens("credito entrada nao cumulatividade abater compras insumos desconta"),
            "resposta": (
                "No novo sistema você **abate** (credita) o IBS/CBS pago nas suas compras de insumos, "
                "serviços, energia, locações, etc. — a chamada **não-cumulatividade plena**. "
                "Assim, o imposto incide só sobre o valor que você agrega. No Simples Nacional não há crédito "
                "(salvo opção pelo regime regular de IBS/CBS)."
            ),
            "fontes": ["LC 214/2025, Arts. 47–57"],
        },
        {
            "titulo": "Visão geral da reforma",
            "kw": _tokens("muda resumo geral panorama funciona novidade visao iva dual"),
            "resposta": (
                "A Reforma Tributária do consumo substitui 5 tributos (PIS, COFINS, IPI, ICMS e ISS) "
                "por 3: **CBS** (federal), **IBS** (estadual/municipal) e o **IS** (Imposto Seletivo). "
                "O novo sistema é **não-cumulativo** (crédito amplo das compras), cobrado no **destino** "
                "(onde está o consumidor) e tem transição de **2026 a 2033**."
            ),
            "fontes": ["EC 132/2023; LC 214/2025"],
        },
    ]


@lru_cache(maxsize=1)
def _base_conhecimento() -> list[dict]:
    entradas: list[dict] = []

    # 1) Intents curados — prioridade sobre termos genéricos do glossário
    for it in _intents():
        entradas.append({"kw": set(it["kw"]), "sigla": "", "resposta": it["resposta"], "fontes": it["fontes"]})

    # 2) Glossário (definições curadas em linguagem simples)
    termos = _load("glossario").get("termos", {})
    for chave, t in termos.items():
        kw = set(_tokens(chave.replace("_", " ")))
        sigla = _norm(t.get("sigla") or "").strip()
        if sigla:
            kw.add(sigla)
        kw |= set(_tokens(t.get("nome_completo", "")))
        partes = [t.get("resumo", "")]
        if t.get("impacto"):
            partes.append(t["impacto"])
        if t.get("vigencia"):
            partes.append(f"Vigência: {t['vigencia']}")
        if t.get("aviso"):
            partes.append(t["aviso"])
        resposta = f"**{t.get('nome_completo', chave)}** — " + " ".join(p for p in partes if p)
        fontes = ["Glossário do sistema"]
        if t.get("base_legal"):
            fontes.append(t["base_legal"])
        entradas.append({"kw": kw, "sigla": sigla, "resposta": resposta, "fontes": fontes})

    # 3) Setores (redução por atividade)
    for s in _load("setores").get("setores", []):
        kw = set(_tokens(s["nome"])) | set(_tokens(s["id"].replace("_", " ")))
        red = s.get("reducao_aliquota", 0.0)
        if red >= 1.0:
            txt = "tem **alíquota zero** de IBS e CBS no novo sistema."
        elif red > 0:
            txt = f"tem **redução de {int(red * 100)}%** nas alíquotas de IBS e CBS."
        else:
            txt = "paga a **alíquota cheia** de IBS/CBS (sem redução setorial específica)."
        resposta = f"O setor **{s['nome']}** {txt}"
        entradas.append({"kw": kw, "sigla": "", "resposta": resposta, "fontes": ["LC 214/2025"]})

    return entradas


def responder(pergunta: str) -> dict:
    q = _tokens(pergunta)
    qset = set(q)

    if not qset:
        return {
            "resposta": (
                "Olá! Sou o assistente da Reforma Tributária (LC 214/2025). Posso explicar IBS, CBS, "
                "Imposto Seletivo, cronograma, reduções por setor, Simples/MEI, Split Payment e mais. "
                "Faça uma pergunta ou toque numa sugestão abaixo."
            ),
            "fontes": [],
            "sugestoes": _SUGESTOES,
        }

    melhor = None
    melhor_score = 0
    for e in _base_conhecimento():
        score = len(qset & e["kw"])
        if e.get("sigla") and e["sigla"] in qset:
            score += 3  # acerto de sigla (IBS, CBS, IS...) pesa mais
        if score > melhor_score:
            melhor_score = score
            melhor = e

    if melhor and melhor_score >= 1:
        return {
            "resposta": melhor["resposta"] + "\n\n" + _DISCLAIMER,
            "fontes": melhor["fontes"],
            "sugestoes": _SUGESTOES,
        }

    # Saudação
    if qset & {"oi", "ola", "ajuda", "bom", "boa", "dia", "tarde", "noite", "ajudar"}:
        return {
            "resposta": (
                "Olá! Sou o assistente da Reforma Tributária. Pergunte sobre IBS, CBS, Imposto Seletivo, "
                "cronograma da transição, reduções por setor, Simples/MEI ou Split Payment."
            ),
            "fontes": [],
            "sugestoes": _SUGESTOES,
        }

    # Sem correspondência — orienta sem inventar
    return {
        "resposta": (
            "Não encontrei isso na minha base. Tente reformular ou pergunte sobre: **IBS**, **CBS**, "
            "**Imposto Seletivo**, **cronograma** da transição, **redução** do seu setor, **Simples/MEI**, "
            "**Split Payment** ou **cesta básica**. Para números, use o **Simulador** e o **Comparador**.\n\n"
            + _DISCLAIMER
        ),
        "fontes": [],
        "sugestoes": _SUGESTOES,
    }
