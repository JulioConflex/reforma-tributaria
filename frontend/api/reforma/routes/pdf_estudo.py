from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from io import BytesIO
import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether,
)
from reportlab.platypus.flowables import Flowable

router = APIRouter(prefix="/api/py", tags=["pdf"])

# ─── Palette ─────────────────────────────────────────────────────────────────
BRAND   = colors.HexColor("#0070F3")
EMERALD = colors.HexColor("#10B981")
AMBER   = colors.HexColor("#F59E0B")
RED_C   = colors.HexColor("#EF4444")
INK_900 = colors.HexColor("#111827")
INK_600 = colors.HexColor("#4B5563")
INK_400 = colors.HexColor("#9CA3AF")
INK_100 = colors.HexColor("#F3F4F6")
INK_50  = colors.HexColor("#F9FAFB")
WHITE   = colors.white
BRAND_50 = colors.HexColor("#EFF6FF")
EMRLD_50 = colors.HexColor("#ECFDF5")
EMRLD_100 = colors.HexColor("#D1FAE5")
EMRLD_200 = colors.HexColor("#A7F3D0")

# ─── Helpers ─────────────────────────────────────────────────────────────────
def brl(value: float) -> str:
    abs_v = abs(value)
    s = f"R$ {abs_v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-{s}" if value < 0 else s

def pct(value: float, decimals: int = 2) -> str:
    return f"{value:.{decimals}f}%"

def _styles() -> dict:
    def s(name, **kw):
        return ParagraphStyle(name, **kw)
    return {
        "title":        s("T",    fontName="Helvetica-Bold", fontSize=26, textColor=INK_900, leading=30, spaceAfter=4),
        "subtitle":     s("ST",   fontName="Helvetica",      fontSize=13, textColor=INK_600, leading=18, spaceAfter=2),
        "h1":           s("H1",   fontName="Helvetica-Bold", fontSize=13, textColor=INK_900, leading=18, spaceBefore=14, spaceAfter=5),
        "h2":           s("H2",   fontName="Helvetica-Bold", fontSize=11, textColor=INK_900, leading=15, spaceBefore=10, spaceAfter=4),
        "label":        s("LBL",  fontName="Helvetica-Bold", fontSize=9,  textColor=INK_600, leading=12, spaceAfter=1),
        "body":         s("BD",   fontName="Helvetica",      fontSize=10, textColor=INK_600, leading=15, spaceAfter=4),
        "body_j":       s("BDJ",  fontName="Helvetica",      fontSize=10, textColor=INK_600, leading=15, spaceAfter=4, alignment=TA_JUSTIFY),
        "small":        s("SM",   fontName="Helvetica",      fontSize=8.5,textColor=INK_400, leading=12, spaceAfter=3),
        "badge_ok":     s("BOK",  fontName="Helvetica-Bold", fontSize=8,  textColor=EMERALD, leading=10),
        "badge_no":     s("BNO",  fontName="Helvetica-Bold", fontSize=8,  textColor=INK_400, leading=10),
        "disclaimer":   s("DS",   fontName="Helvetica-Oblique", fontSize=8, textColor=INK_400, leading=12, spaceBefore=6, spaceAfter=6, alignment=TA_JUSTIFY),
        "cell_l":       s("CL_L", fontName="Helvetica",      fontSize=9.5,textColor=INK_900, leading=13),
        "cell_r":       s("CL_R", fontName="Helvetica",      fontSize=9.5,textColor=INK_900, leading=13, alignment=TA_RIGHT),
        "cell_bold":    s("CL_B", fontName="Helvetica-Bold", fontSize=9.5,textColor=INK_900, leading=13),
        "cell_bold_r":  s("CL_BR",fontName="Helvetica-Bold", fontSize=9.5,textColor=INK_900, leading=13, alignment=TA_RIGHT),
        "cell_green_r": s("CL_GR",fontName="Helvetica-Bold", fontSize=9.5,textColor=EMERALD, leading=13, alignment=TA_RIGHT),
        "cell_red_r":   s("CL_RR",fontName="Helvetica-Bold", fontSize=9.5,textColor=RED_C,   leading=13, alignment=TA_RIGHT),
        "cell_header":  s("CH",   fontName="Helvetica-Bold", fontSize=8.5,textColor=WHITE,   leading=12, alignment=TA_CENTER),
        "cell_header_l":s("CHL",  fontName="Helvetica-Bold", fontSize=8.5,textColor=WHITE,   leading=12),
    }

def _table_style(header_color=BRAND, stripe=True) -> TableStyle:
    return TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), header_color),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, INK_50] if stripe else [WHITE]),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW",    (0, 1), (-1, -2), 0.3, INK_100),
    ])

class ColorBar(Flowable):
    def __init__(self, color=BRAND, height=4, width=None):
        super().__init__()
        self._color = color
        self._h = height
        self._w = width

    def wrap(self, availWidth, availHeight):
        self.width = self._w or availWidth
        self.height = self._h
        return self.width, self.height

    def draw(self):
        self.canv.setFillColor(self._color)
        self.canv.rect(0, 0, self.width, self.height, fill=1, stroke=0)

# ─── Pydantic schema ──────────────────────────────────────────────────────────
class RegimeResult(BaseModel):
    regime: str
    nome: str
    descricao: str
    disponivel: bool
    motivo_indisponivel: Optional[str] = None
    total_atual: Optional[float] = None
    percentual_atual: Optional[float] = None
    total_novo: Optional[float] = None
    percentual_novo: Optional[float] = None
    diferenca: Optional[float] = None
    diferenca_percentual: Optional[float] = None
    economia_anual_estimada: Optional[float] = None
    irpj_csll_estimado: Optional[float] = None

class ComparadorData(BaseModel):
    valor_base: float
    setor: str
    uf: str
    ano: int
    comparativo: list[RegimeResult]
    regime_mais_vantajoso: Optional[str] = None
    regime_mais_vantajoso_nome: Optional[str] = None
    obs: str = ""
    valores_projetados: bool = False

class EstudoInput(BaseModel):
    razao_social: str = Field(..., min_length=1)
    cnpj: str = ""
    faturamento_anual: float = Field(..., ge=0)
    despesas_mensais: Optional[float] = None
    regime_atual: str = ""          # mei | simples_nacional | lucro_presumido | lucro_real
    resultado_financeiro: str = ""  # lucrativa | equilibrio | prejuizo
    perfil_clientes: str = ""       # pf | pj | misto
    objetivo_estudo: str = ""       # comparar | mudanca | reforma
    contador_nome: str = ""
    contador_crc: str = ""
    comparador: ComparadorData

# ─── Label maps ──────────────────────────────────────────────────────────────
_REGIME_LABEL = {
    "mei": "MEI",
    "simples_nacional": "Simples Nacional",
    "lucro_presumido": "Lucro Presumido",
    "lucro_real": "Lucro Real",
}
_RESULTADO_LABEL = {
    "lucrativa": "Lucrativa",
    "equilibrio": "Em equilíbrio",
    "prejuizo": "Em prejuízo",
}
_PERFIL_LABEL = {
    "pf": "Maioria Pessoa Física (B2C)",
    "pj": "Maioria Pessoa Jurídica (B2B)",
    "misto": "Misto (PF + PJ)",
}
_OBJETIVO_LABEL = {
    "comparar": "Comparar regimes disponíveis",
    "mudanca": "Planejar mudança de regime",
    "reforma": "Avaliar impacto da Reforma Tributária",
}

# ─── PDF builder ─────────────────────────────────────────────────────────────
def _build_pdf(inp: EstudoInput) -> bytes:
    buf = BytesIO()
    ST = _styles()
    W, H = A4
    margin = 2.0 * cm

    today = datetime.date.today().strftime("%d/%m/%Y")
    comp = inp.comparador
    disponiveis = [r for r in comp.comparativo if r.disponivel]
    melhor_key = comp.regime_mais_vantajoso

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BRAND)
        canvas.rect(0, H - 8, W, 8, fill=1, stroke=0)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(INK_400)
        canvas.drawCentredString(W / 2, 14, "Conflex Contabilidade — Rua XV de novembro, 1155, 10° Andar, Curitiba/PR — (41) 3277-1313")
        canvas.drawRightString(W - margin, 14, f"Pag. {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=margin, rightMargin=margin,
        topMargin=margin + 4, bottomMargin=margin,
        onFirstPage=on_page, onLaterPages=on_page,
    )
    story = []

    # ── CAPA ────────────────────────────────────────────────────────────────
    story.append(ColorBar(BRAND, height=6))
    story.append(Spacer(1, 18))
    story.append(Paragraph("Estudo Tributario", ST["title"]))
    story.append(Paragraph("Analise Comparativa de Regimes - Sistema Atual e Reforma Tributaria", ST["subtitle"]))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=INK_100, spaceAfter=12))

    info_rows = [[Paragraph("<b>Empresa</b>", ST["cell_bold"]), Paragraph(inp.razao_social, ST["cell_l"])]]
    if inp.cnpj:
        info_rows.append([Paragraph("<b>CNPJ</b>", ST["cell_bold"]), Paragraph(inp.cnpj, ST["cell_l"])])
    info_rows += [
        [Paragraph("<b>Setor</b>",             ST["cell_bold"]), Paragraph(comp.setor, ST["cell_l"])],
        [Paragraph("<b>Estado (UF)</b>",        ST["cell_bold"]), Paragraph(comp.uf, ST["cell_l"])],
        [Paragraph("<b>Ano de referencia</b>",  ST["cell_bold"]), Paragraph(str(comp.ano), ST["cell_l"])],
        [Paragraph("<b>Faturamento anual</b>",  ST["cell_bold"]), Paragraph(brl(inp.faturamento_anual), ST["cell_l"])],
        [Paragraph("<b>Data de emissao</b>",    ST["cell_bold"]), Paragraph(today, ST["cell_l"])],
    ]
    if inp.regime_atual:
        info_rows.append([Paragraph("<b>Regime atual</b>", ST["cell_bold"]),
                          Paragraph(_REGIME_LABEL.get(inp.regime_atual, inp.regime_atual), ST["cell_l"])])
    if inp.resultado_financeiro:
        info_rows.append([Paragraph("<b>Resultado atual</b>", ST["cell_bold"]),
                          Paragraph(_RESULTADO_LABEL.get(inp.resultado_financeiro, inp.resultado_financeiro), ST["cell_l"])])
    if inp.perfil_clientes:
        info_rows.append([Paragraph("<b>Perfil dos clientes</b>", ST["cell_bold"]),
                          Paragraph(_PERFIL_LABEL.get(inp.perfil_clientes, inp.perfil_clientes), ST["cell_l"])])
    if inp.objetivo_estudo:
        info_rows.append([Paragraph("<b>Objetivo do estudo</b>", ST["cell_bold"]),
                          Paragraph(_OBJETIVO_LABEL.get(inp.objetivo_estudo, inp.objetivo_estudo), ST["cell_l"])])

    info_t = Table(info_rows, colWidths=[5.2 * cm, None])
    info_t.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LEFTPADDING",  (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW",    (0, 0), (-1, -2), 0.3, INK_100),
    ]))
    story.append(info_t)
    story.append(Spacer(1, 14))

    # Intro personalizada por objetivo
    if inp.objetivo_estudo == "reforma":
        intro = (
            "Este estudo analisa o impacto da Reforma Tributaria (LC 214/2025) sobre a carga tributaria de "
            f"<b>{inp.razao_social}</b>, comparando o sistema atual com o novo sistema a partir de {comp.ano}. "
            "O foco e entender como o CBS e o IBS alteram os custos por regime e quais decisoes sao recomendadas "
            "para a transicao."
        )
    elif inp.objetivo_estudo == "mudanca":
        regime_atual_nome = _REGIME_LABEL.get(inp.regime_atual, "regime atual") if inp.regime_atual else "regime atual"
        intro = (
            f"Este estudo avalia a viabilidade de mudanca de regime tributario para <b>{inp.razao_social}</b>, "
            f"atualmente no <b>{regime_atual_nome}</b>. A analise compara os quatro regimes disponiveis no Brasil "
            f"(MEI, Simples Nacional, Lucro Presumido e Lucro Real) no sistema atual e no novo sistema (Reforma Tributaria - "
            f"LC 214/2025), com foco em identificar o momento e o regime mais adequados para uma eventual transicao."
        )
    else:
        intro = (
            f"Este estudo compara os regimes de tributacao disponiveis no Brasil (MEI, Simples Nacional, "
            f"Lucro Presumido e Lucro Real) para <b>{inp.razao_social}</b>, analisando a carga tributaria no "
            f"sistema atual e no novo sistema (Reforma Tributaria - LC 214/2025) a partir de {comp.ano}. "
            "Os calculos usam a legislacao vigente; mudancas futuras na lei nao estao contempladas aqui."
        )
    story.append(Paragraph(intro, ST["body_j"]))

    if comp.valores_projetados:
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            "<b>Atencao:</b> As aliquotas de referencia do IBS (~18,7%) e CBS (~9,3%) ainda nao foram confirmadas "
            "pelo Senado Federal. Os valores do novo sistema sao estimativas sujeitas a alteracao.",
            ST["small"]))

    # ── 1. PERFIL FINANCEIRO ─────────────────────────────────────────────────
    if inp.resultado_financeiro or inp.despesas_mensais is not None:
        story.append(Paragraph("1. Perfil Financeiro da Empresa", ST["h1"]))

        if inp.resultado_financeiro:
            res_label = _RESULTADO_LABEL.get(inp.resultado_financeiro, "")
            if inp.resultado_financeiro == "lucrativa":
                res_txt = (
                    f"A empresa se encontra em situacao <b>{res_label}</b>. "
                    "No Lucro Real, isso significa que havera IRPJ e CSLL sobre o lucro apurado, "
                    "o que tende a elevar a carga total nesse regime. O Simples Nacional e o Lucro Presumido "
                    "calculam o imposto sobre o faturamento, independentemente do resultado."
                )
            elif inp.resultado_financeiro == "prejuizo":
                res_txt = (
                    f"A empresa se encontra em situacao de <b>{res_label}</b>. "
                    "No Lucro Real, o prejuizo elimina o IRPJ e a CSLL do periodo, pois o imposto incide "
                    "apenas sobre o lucro efetivo. O prejuizo acumulado tambem pode ser compensado em ate "
                    "30% do lucro de anos futuros. Ainda assim, o ISS (ou IBS), o PIS e a COFINS (ou CBS) "
                    "continuam sendo devidos sobre o faturamento, independentemente do resultado."
                )
            else:
                res_txt = (
                    f"A empresa se encontra em <b>{res_label}</b>. "
                    "No Lucro Real, o IRPJ e a CSLL incidem apenas sobre o lucro positivo. "
                    "Em situacao de equilibrio, esses tributos tendem a ser reduzidos ou zerados."
                )
            story.append(Paragraph(res_txt, ST["body_j"]))

        if inp.despesas_mensais is not None:
            story.append(Paragraph(
                f"<b>Despesas medias mensais informadas (Lucro Real):</b> {brl(inp.despesas_mensais)} — "
                "utilizadas para estimar a base de calculo do IRPJ/CSLL.",
                ST["body"]))

    # ── 2. COMPARATIVO — SISTEMA ATUAL ───────────────────────────────────────
    sec = 2 if (inp.resultado_financeiro or inp.despesas_mensais is not None) else 1
    story.append(Paragraph(f"{sec}. Sistema Atual - Carga por Regime", ST["h1"]))
    story.append(Paragraph(
        f"Carga tributaria por operacao de {brl(comp.valor_base)}, incluindo IRPJ/CSLL atribuivel a operacao.",
        ST["body"]))

    hdr_a = [Paragraph("Regime", ST["cell_header_l"]),
              Paragraph("Carga Total", ST["cell_header"]),
              Paragraph("% s/ Operacao", ST["cell_header"]),
              Paragraph("Situacao", ST["cell_header"])]
    rows_a = [hdr_a]
    for r in comp.comparativo:
        is_best = r.regime == melhor_key and r.disponivel
        is_current = r.regime == inp.regime_atual
        nome_txt = r.nome + (" (atual)" if is_current else "")
        nome_p = Paragraph(f"<b>{nome_txt}</b>" if is_best or is_current else nome_txt,
                           ST["cell_bold"] if is_best or is_current else ST["cell_l"])
        if r.disponivel:
            val_p = Paragraph(brl(r.total_atual or 0), ST["cell_green_r"] if is_best else ST["cell_r"])
            pct_p = Paragraph(pct(r.percentual_atual or 0), ST["cell_r"])
            sit_p = Paragraph("Disponivel", ST["badge_ok"])
        else:
            val_p = Paragraph("--", ST["cell_r"])
            pct_p = Paragraph("--", ST["cell_r"])
            sit_p = Paragraph("Vedado", ST["badge_no"])
        rows_a.append([nome_p, val_p, pct_p, sit_p])

    t_a = Table(rows_a, colWidths=[7.5 * cm, 4.0 * cm, 4.0 * cm, 3.0 * cm])
    t_a.setStyle(_table_style())
    story.append(t_a)

    # ── 3. COMPARATIVO — NOVO SISTEMA ────────────────────────────────────────
    sec += 1
    story.append(Spacer(1, 14))
    story.append(Paragraph(f"{sec}. Novo Sistema ({comp.ano}) - Carga por Regime", ST["h1"]))
    story.append(Paragraph(
        f"Carga tributaria estimada apos a Reforma Tributaria (LC 214/2025) para o ano {comp.ano}.",
        ST["body"]))

    sorted_disp = sorted(disponiveis, key=lambda x: x.total_novo or 0)
    ranking = {r.regime: i + 1 for i, r in enumerate(sorted_disp)}

    hdr_n = [Paragraph("Regime", ST["cell_header_l"]),
              Paragraph("Carga Nova", ST["cell_header"]),
              Paragraph("% s/ Operacao", ST["cell_header"]),
              Paragraph("Ranking", ST["cell_header"])]
    rows_n = [hdr_n]
    for r in comp.comparativo:
        is_best = r.regime == melhor_key and r.disponivel
        is_current = r.regime == inp.regime_atual
        nome_txt = r.nome + (" (atual)" if is_current else "")
        nome_p = Paragraph(f"<b>{nome_txt}</b>" if is_best or is_current else nome_txt,
                           ST["cell_bold"] if is_best or is_current else ST["cell_l"])
        if r.disponivel:
            rank = ranking.get(r.regime, "--")
            rk_txt = f"#{rank}" + (" (Melhor)" if is_best else "")
            rows_n.append([
                nome_p,
                Paragraph(brl(r.total_novo or 0), ST["cell_green_r"] if is_best else ST["cell_r"]),
                Paragraph(pct(r.percentual_novo or 0), ST["cell_r"]),
                Paragraph(rk_txt, ST["badge_ok"] if is_best else ST["cell_l"]),
            ])
        else:
            rows_n.append([nome_p, Paragraph("--", ST["cell_r"]), Paragraph("--", ST["cell_r"]),
                            Paragraph("Vedado", ST["badge_no"])])

    t_n = Table(rows_n, colWidths=[7.5 * cm, 4.0 * cm, 4.0 * cm, 3.0 * cm])
    t_n.setStyle(_table_style(EMERALD))
    story.append(t_n)

    # ── 4. VARIACAO ───────────────────────────────────────────────────────────
    sec += 1
    story.append(Spacer(1, 14))
    story.append(Paragraph(f"{sec}. Variacao: Sistema Atual x Novo Sistema", ST["h1"]))

    hdr_v = [
        Paragraph("Regime", ST["cell_header_l"]),
        Paragraph("Atual", ST["cell_header"]),
        Paragraph("Novo", ST["cell_header"]),
        Paragraph("Diferenca", ST["cell_header"]),
        Paragraph("Var. %", ST["cell_header"]),
        Paragraph("Econ./Ano est.", ST["cell_header"]),
    ]
    rows_v = [hdr_v]
    for r in comp.comparativo:
        is_best = r.regime == melhor_key and r.disponivel
        is_current = r.regime == inp.regime_atual
        nome_txt = r.nome + (" (atual)" if is_current else "")
        nome_p = Paragraph(f"<b>{nome_txt}</b>" if is_best or is_current else nome_txt,
                           ST["cell_bold"] if is_best or is_current else ST["cell_l"])
        if r.disponivel:
            diff = r.diferenca or 0
            diff_pct = r.diferenca_percentual or 0
            eco = r.economia_anual_estimada or 0
            prefix = "+" if diff > 0 else ""
            diff_s = ST["cell_red_r"] if diff > 0 else ST["cell_green_r"]
            eco_s  = ST["cell_green_r"] if eco < 0 else ST["cell_red_r"]
            rows_v.append([
                nome_p,
                Paragraph(brl(r.total_atual or 0), ST["cell_r"]),
                Paragraph(brl(r.total_novo or 0), ST["cell_green_r"] if is_best else ST["cell_r"]),
                Paragraph(f"{prefix}{brl(diff)}", diff_s),
                Paragraph(f"{prefix}{pct(diff_pct, 1)}", diff_s),
                Paragraph(brl(eco), eco_s),
            ])
        else:
            rows_v.append([nome_p] + [Paragraph("--", ST["cell_r"])] * 5)

    t_v = Table(rows_v, colWidths=[5.0 * cm, 3.0 * cm, 3.0 * cm, 3.0 * cm, 2.5 * cm, 3.5 * cm])
    t_v.setStyle(_table_style(colors.HexColor("#4B5563")))
    story.append(t_v)

    # ── 5. DESTAQUE DO MELHOR REGIME ─────────────────────────────────────────
    if melhor_key and disponiveis:
        melhor_obj = next((r for r in disponiveis if r.regime == melhor_key), None)
        if melhor_obj:
            sec += 1
            story.append(Spacer(1, 14))
            story.append(KeepTogether([
                Paragraph(f"{sec}. Regime Mais Vantajoso para o Novo Sistema", ST["h1"]),
                ColorBar(EMERALD, height=3),
                Spacer(1, 8),
            ]))

            pior = max(disponiveis, key=lambda x: x.total_novo or 0)
            economia_op = (pior.total_novo or 0) - (melhor_obj.total_novo or 0)
            economia_anual = (economia_op / comp.valor_base * inp.faturamento_anual
                              if comp.valor_base > 0 else 0)

            dest_rows = [
                [Paragraph("Regime recomendado", ST["cell_bold"]),
                 Paragraph(melhor_obj.nome, ST["cell_green_r"])],
                [Paragraph("Carga tributaria (novo sistema)", ST["cell_bold"]),
                 Paragraph(brl(melhor_obj.total_novo or 0), ST["cell_green_r"])],
                [Paragraph("% sobre operacao", ST["cell_bold"]),
                 Paragraph(pct(melhor_obj.percentual_novo or 0), ST["cell_r"])],
            ]
            if economia_anual > 0:
                dest_rows.append([
                    Paragraph(f"Economia anual estimada vs {pior.nome}", ST["cell_bold"]),
                    Paragraph(brl(economia_anual), ST["cell_green_r"]),
                ])
            if inp.regime_atual and inp.regime_atual != melhor_key:
                regime_atual_obj = next((r for r in disponiveis if r.regime == inp.regime_atual), None)
                if regime_atual_obj:
                    dif_atual = (regime_atual_obj.total_novo or 0) - (melhor_obj.total_novo or 0)
                    eco_vs_atual = dif_atual / comp.valor_base * inp.faturamento_anual if comp.valor_base > 0 else 0
                    if eco_vs_atual > 0:
                        dest_rows.append([
                            Paragraph(f"Economia vs regime atual ({regime_atual_obj.nome})", ST["cell_bold"]),
                            Paragraph(brl(eco_vs_atual), ST["cell_green_r"]),
                        ])
            if melhor_obj.irpj_csll_estimado and melhor_obj.irpj_csll_estimado > 0:
                dest_rows.append([
                    Paragraph("IRPJ/CSLL incluido", ST["cell_bold"]),
                    Paragraph(brl(melhor_obj.irpj_csll_estimado), ST["cell_r"]),
                ])

            dest_t = Table(dest_rows, colWidths=[9.5 * cm, None])
            dest_t.setStyle(TableStyle([
                ("BACKGROUND",   (0, 0), (-1, 0), EMRLD_100),
                ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, EMRLD_50]),
                ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING",   (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING",(0, 0), (-1, -1), 7),
                ("LEFTPADDING",  (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("LINEBELOW",    (0, 0), (-1, -2), 0.3, EMRLD_200),
                ("BOX",          (0, 0), (-1, -1), 0.8, EMERALD),
                ("LINEBEFORE",   (0, 0), (0, -1), 3, EMERALD),
            ]))
            story.append(dest_t)

    # ── 6. REFORMA TRIBUTARIA — texto adaptado ao perfil de clientes ─────────
    sec += 1
    story.append(Spacer(1, 14))
    story.append(Paragraph(f"{sec}. O que Muda com a Reforma Tributaria", ST["h1"]))

    reforma_itens = [
        ("A partir de 2027", "criacao da CBS, tributo federal que substitui o PIS e a COFINS."),
        ("A partir de 2029", "criacao do IBS, que substitui o ISS e o ICMS, com transicao progressiva ate 2032."),
        ("IRPJ e CSLL", "permanecem sem alteracao estrutural."),
        ("Simples Nacional", "continuara com guia unica (DAS), mas as regras de cobranca de CBS/IBS ainda serao definidas pelo Comite Gestor do IBS."),
    ]
    for titulo, texto in reforma_itens:
        story.append(Paragraph(f"<b>{titulo}:</b> {texto}", ST["body"]))

    story.append(Spacer(1, 6))

    # Credito CBS/IBS personalizado por perfil de clientes
    if inp.perfil_clientes == "pj":
        cred_txt = (
            "<b>Ponto critico para o perfil desta empresa (clientes majoritariamente PJ/B2B):</b> "
            "As notas fiscais passarao a destacar CBS e IBS. Clientes do Lucro Real ou Presumido poderao "
            "usar esses valores como credito tributario, abatendo parte dos proprios impostos. "
            "Caso a empresa esteja no Simples Nacional, o credito cedido ao cliente tende a ser "
            "<b>menor</b> do que se a compra fosse feita de um fornecedor do Lucro Real ou Presumido. "
            "Isso pode ser um fator competitivo relevante na escolha de fornecedor. "
            "O Simples Nacional Hibrido (que recolhe CBS/IBS pela aliquota cheia) permite oferecer "
            "credito completo, mas implica maior custo tributario. Recomendamos avaliar essa opcao "
            "em 2027, quando as regras estiverem definidas e o perfil dos clientes estiver mapeado."
        )
    elif inp.perfil_clientes == "misto":
        cred_txt = (
            "<b>Clientes com perfil misto (PF e PJ):</b> As notas fiscais passarao a destacar CBS e IBS. "
            "Para clientes PJ (Lucro Real ou Presumido), esse valor pode ser usado como credito tributario. "
            "Se a empresa estiver no Simples Nacional, o credito cedido sera menor do que o de um fornecedor "
            "do Lucro Real ou Presumido. Avalie o percentual de clientes PJ que valorizam esse credito "
            "antes de considerar o Simples Nacional Hibrido, pois ele eleva o custo tributario."
        )
    else:
        cred_txt = (
            "As notas fiscais passarao a destacar CBS e IBS. Como os clientes sao majoritariamente "
            "pessoa fisica (B2C), o credito tributario cedido ao cliente tem relevancia reduzida "
            "neste caso, pois pessoas fisicas nao aproveitam creditos de CBS/IBS. "
            "A escolha de regime deve ser guiada principalmente pelo menor custo tributario da empresa, "
            "sem preocupacao com a competitividade de credito cedido."
        )
    story.append(Paragraph(cred_txt, ST["body_j"]))

    # ── 7. CONCLUSAO ─────────────────────────────────────────────────────────
    story.append(PageBreak())
    sec += 1
    story.append(Paragraph(f"{sec}. Conclusao e Recomendacao", ST["h1"]))

    melhor_obj2 = next((r for r in disponiveis if r.regime == melhor_key), None) if melhor_key else None

    if inp.objetivo_estudo == "mudanca" and inp.regime_atual and melhor_key and inp.regime_atual != melhor_key:
        regime_atual_nome = _REGIME_LABEL.get(inp.regime_atual, inp.regime_atual)
        melhor_nome = melhor_obj2.nome if melhor_obj2 else melhor_key
        conclusao = (
            f"Com base na analise realizada, a empresa <b>{inp.razao_social}</b> pode se beneficiar "
            f"de uma mudanca do <b>{regime_atual_nome}</b> para o <b>{melhor_nome}</b>, "
            f"que representa a menor carga tributaria no novo sistema para o ano {comp.ano}. "
        )
        if melhor_obj2:
            conclusao += (
                f"A carga estimada no {melhor_nome} seria de <b>{brl(melhor_obj2.total_novo or 0)}</b> "
                f"por operacao de {brl(comp.valor_base)} ({pct(melhor_obj2.percentual_novo or 0)} sobre o valor). "
            )
        conclusao += (
            "A saida do regime atual por escolha propria geralmente vale a partir de 1 de janeiro "
            "do ano seguinte. Recomendamos acompanhar os resultados ao longo do segundo semestre "
            "para confirmar se a mudanca e vantajosa antes da comunicacao a Receita Federal."
        )
    elif inp.objetivo_estudo == "reforma":
        if melhor_obj2:
            conclusao = (
                f"Diante da Reforma Tributaria (LC 214/2025), o regime mais vantajoso para "
                f"<b>{inp.razao_social}</b> em {comp.ano} e o <b>{melhor_obj2.nome}</b>, "
                f"com carga de <b>{brl(melhor_obj2.total_novo or 0)}</b> por operacao de {brl(comp.valor_base)}. "
                "O CBS substituira PIS/COFINS a partir de 2027 e o IBS substituira ISS/ICMS progressivamente "
                "ate 2032. Os valores apresentados sao estimativas baseadas nas aliquotas de referencia — "
                "recomendamos revisar esta analise anualmente conforme as aliquotas definitivas forem publicadas."
            )
        else:
            conclusao = (
                "A Reforma Tributaria introduz mudancas relevantes que devem ser acompanhadas anualmente. "
                "Recomendamos revisar esta analise quando as aliquotas definitivas de CBS e IBS forem publicadas."
            )
    else:
        if melhor_obj2:
            conclusao = (
                f"Com base nos dados analisados, o regime mais vantajoso para "
                f"<b>{inp.razao_social}</b> no novo sistema tributario ({comp.ano}) "
                f"e o <b>{melhor_obj2.nome}</b>, com carga de "
                f"<b>{brl(melhor_obj2.total_novo or 0)}</b> por operacao de "
                f"{brl(comp.valor_base)} ({pct(melhor_obj2.percentual_novo or 0)} sobre o valor)."
            )
        else:
            conclusao = "Nenhum regime disponivel foi identificado para os parametros informados."

    story.append(Paragraph(conclusao, ST["body_j"]))
    story.append(Spacer(1, 6))

    recomendacao_geral = (
        "Recomendamos revisar esta analise anualmente, ao fechar o balanco, "
        "para confirmar se o regime continua sendo a melhor opcao a luz do "
        "faturamento, lucro e estrutura de despesas do periodo."
    )
    story.append(Paragraph(recomendacao_geral, ST["body_j"]))

    # Disclaimer
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=INK_100, spaceAfter=10))
    story.append(Paragraph(
        "Este estudo tem carater informativo e foi elaborado com base nos dados fornecidos "
        "e na legislacao vigente na data de emissao. Nao substitui a analise individualizada "
        "do contador responsavel pela empresa. Decisoes de mudanca de regime tributario devem "
        "ser validadas por profissional habilitado antes de qualquer comunicacao a Receita Federal.",
        ST["disclaimer"]))

    # Assinatura
    story.append(Spacer(1, 24))
    story.append(Paragraph("______________________________", ST["body"]))
    if inp.contador_nome:
        story.append(Paragraph(inp.contador_nome, ST["body"]))
        if inp.contador_crc:
            story.append(Paragraph(f"CRC {inp.contador_crc}", ST["small"]))
    else:
        story.append(Paragraph("Conflex Contabilidade", ST["body"]))
        story.append(Paragraph(f"Data: {today}", ST["small"]))

    doc.build(story)
    return buf.getvalue()


# ─── Route ───────────────────────────────────────────────────────────────────
@router.post("/gerar-estudo-tributario")
def gerar_estudo_tributario(inp: EstudoInput):
    pdf_bytes = _build_pdf(inp)
    nome = inp.razao_social.replace(" ", "_")[:40]
    filename = f"Estudo_Tributario_{nome}_{inp.comparador.ano}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
