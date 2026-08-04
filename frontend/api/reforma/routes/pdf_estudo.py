from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from io import BytesIO
import datetime
import os

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether, Image,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus.flowables import Flowable

from ..engine.calculadora import (
    calcular_sistema_atual, calcular_sistema_novo, _irpj_csll_por_operacao,
)
from ..engine.regras import get_setor, get_cronograma, get_icms_uf

router = APIRouter(prefix="/api/py", tags=["pdf"])

# ─── Palette ─────────────────────────────────────────────────────────────────
BRAND     = colors.HexColor("#0070F3")
NAVY      = colors.HexColor("#0D2340")
EMERALD   = colors.HexColor("#10B981")
AMBER     = colors.HexColor("#F59E0B")
RED_C     = colors.HexColor("#EF4444")
INK_900   = colors.HexColor("#111827")
INK_700   = colors.HexColor("#374151")
INK_600   = colors.HexColor("#4B5563")
INK_400   = colors.HexColor("#9CA3AF")
INK_100   = colors.HexColor("#F3F4F6")
INK_50    = colors.HexColor("#F9FAFB")
WHITE     = colors.white
EMRLD_50  = colors.HexColor("#ECFDF5")
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
        "title":          s("T",    fontName="Helvetica-Bold",    fontSize=26, textColor=INK_900, leading=30, spaceAfter=4),
        "subtitle":       s("ST",   fontName="Helvetica",         fontSize=13, textColor=INK_600, leading=18, spaceAfter=2),
        "title_inv":      s("TI",   fontName="Helvetica-Bold",    fontSize=22, textColor=WHITE,   leading=26, spaceAfter=4),
        "subtitle_inv":   s("STI",  fontName="Helvetica",         fontSize=11, textColor=colors.HexColor("#A8C4E0"), leading=16, spaceAfter=0),
        "h1":             s("H1",   fontName="Helvetica-Bold",    fontSize=13, textColor=INK_900, leading=18, spaceBefore=4,  spaceAfter=4),
        "h2":             s("H2",   fontName="Helvetica-Bold",    fontSize=11, textColor=INK_900, leading=15, spaceBefore=5,  spaceAfter=3),
        "h3":             s("H3",   fontName="Helvetica-Bold",    fontSize=10, textColor=INK_700, leading=14, spaceBefore=4,  spaceAfter=2),
        "label":          s("LBL",  fontName="Helvetica-Bold",    fontSize=9,  textColor=INK_600, leading=12, spaceAfter=1),
        "body":           s("BD",   fontName="Helvetica",         fontSize=10, textColor=INK_600, leading=15, spaceAfter=4),
        "body_j":         s("BDJ",  fontName="Helvetica",         fontSize=10, textColor=INK_600, leading=15, spaceAfter=4, alignment=TA_JUSTIFY),
        "small":          s("SM",   fontName="Helvetica",         fontSize=8.5,textColor=INK_400, leading=12, spaceAfter=3),
        "small_j":        s("SMJ",  fontName="Helvetica",         fontSize=8.5,textColor=INK_400, leading=12, spaceAfter=3, alignment=TA_JUSTIFY),
        "badge_ok":       s("BOK",  fontName="Helvetica-Bold",    fontSize=8,  textColor=EMERALD, leading=10),
        "badge_no":       s("BNO",  fontName="Helvetica-Bold",    fontSize=8,  textColor=INK_400, leading=10),
        "disclaimer":     s("DS",   fontName="Helvetica-Oblique", fontSize=8,  textColor=INK_400, leading=12, spaceBefore=6, spaceAfter=6, alignment=TA_JUSTIFY),
        "cell_l":         s("CL_L", fontName="Helvetica",         fontSize=9.5,textColor=INK_900, leading=13),
        "cell_r":         s("CL_R", fontName="Helvetica",         fontSize=9.5,textColor=INK_900, leading=13, alignment=TA_RIGHT),
        "cell_bold":      s("CL_B", fontName="Helvetica-Bold",    fontSize=9.5,textColor=INK_900, leading=13),
        "cell_bold_r":    s("CL_BR",fontName="Helvetica-Bold",    fontSize=9.5,textColor=INK_900, leading=13, alignment=TA_RIGHT),
        "cell_green_r":   s("CL_GR",fontName="Helvetica-Bold",    fontSize=9.5,textColor=EMERALD, leading=13, alignment=TA_RIGHT),
        "cell_red_r":     s("CL_RR",fontName="Helvetica-Bold",    fontSize=9.5,textColor=RED_C,   leading=13, alignment=TA_RIGHT),
        "cell_amber_r":   s("CL_AR",fontName="Helvetica-Bold",    fontSize=9.5,textColor=AMBER,   leading=13, alignment=TA_RIGHT),
        "cell_header":    s("CH",   fontName="Helvetica-Bold",    fontSize=8.5,textColor=WHITE,   leading=12, alignment=TA_CENTER),
        "cell_header_l":  s("CHL",  fontName="Helvetica-Bold",    fontSize=8.5,textColor=WHITE,   leading=12),
        "mem_nome":       s("MN",   fontName="Helvetica-Bold",    fontSize=8.5,textColor=INK_900, leading=12),
        "mem_formula":    s("MF",   fontName="Helvetica",         fontSize=7.5,textColor=INK_600, leading=11),
        "mem_aliq":       s("MA",   fontName="Helvetica",         fontSize=8.5,textColor=INK_700, leading=12, alignment=TA_RIGHT),
        "mem_valor":      s("MV",   fontName="Helvetica-Bold",    fontSize=8.5,textColor=INK_900, leading=12, alignment=TA_RIGHT),
        "mem_total":      s("MT",   fontName="Helvetica-Bold",    fontSize=9,  textColor=INK_900, leading=13, alignment=TA_RIGHT),
        "mem_bl":         s("MBL",  fontName="Helvetica-Oblique", fontSize=7,  textColor=INK_400, leading=10),
        "mem_info":       s("MI",   fontName="Helvetica-Oblique", fontSize=8,  textColor=INK_400, leading=11),
        "metric":         s("MT",   fontName="Helvetica-Bold",    fontSize=12, textColor=BRAND,   leading=16, alignment=TA_CENTER),
        "metric_lbl":     s("ML",   fontName="Helvetica",         fontSize=8,  textColor=INK_400, leading=11, alignment=TA_CENTER),
        "toc_title":      s("TCT",  fontName="Helvetica-Bold",    fontSize=16, textColor=BRAND,   leading=22, spaceAfter=12),
        "toc0":           s("TC0",  fontName="Helvetica-Bold",    fontSize=10, textColor=INK_700, leading=16, leftIndent=0,  spaceAfter=3),
        "toc1":           s("TC1",  fontName="Helvetica",         fontSize=9,  textColor=INK_400, leading=14, leftIndent=14, spaceAfter=2),
    }

def _table_style(header_color=BRAND, stripe=True) -> TableStyle:
    return TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), header_color),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, INK_50] if stripe else [WHITE]),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("LINEBELOW",     (0, 1), (-1, -2), 0.3, INK_100),
    ])

def _mem_table_style(header_color=INK_700, sep_rows=None) -> TableStyle:
    cmds = [
        ("BACKGROUND",    (0, 0), (-1, 0), header_color),
        ("ROWBACKGROUNDS",(0, 1), (-1, -2), [WHITE, INK_50]),
        ("BACKGROUND",    (0, -1), (-1, -1), INK_100),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.25, INK_100),
        ("LINEABOVE",     (0, -1), (-1, -1), 0.5, INK_400),
    ]
    for r in (sep_rows or []):
        cmds.extend([
            ("BACKGROUND",   (0, r), (-1, r), colors.HexColor("#DBEAFE")),
            ("FONTNAME",     (0, r), (0, r),  "Helvetica-Bold"),
            ("TEXTCOLOR",    (0, r), (-1, r), colors.HexColor("#1E40AF")),
            ("LINEABOVE",    (0, r), (-1, r), 0.5, colors.HexColor("#93C5FD")),
            ("LINEBELOW",    (0, r), (-1, r), 0.5, colors.HexColor("#93C5FD")),
        ])
    return TableStyle(cmds)

class ColorBar(Flowable):
    def __init__(self, color=BRAND, height=4, width=None):
        super().__init__()
        self._color = color; self._h = height; self._w = width
    def wrap(self, aw, ah):
        self.width = self._w or aw; self.height = self._h
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
    setor_id: str = ""
    credito_entrada: float = Field(default=0.0, ge=0.0, le=1.0)
    folha_pagamento_mensal: Optional[float] = None
    regime_atual: str = ""
    resultado_financeiro: str = ""
    perfil_clientes: str = ""
    objetivo_estudo: list[str] = []
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

# ─── Helpers de seção ─────────────────────────────────────────────────────────
def _memoria_regime_tables(
    ST: dict, regime_key: str, regime_nome: str,
    setor_obj: dict, uf: str, ano: int,
    valor: float, faturamento_anual: float,
    credito_entrada: float,
    folha_pagamento_mensal: Optional[float],
    despesas_mensais: Optional[float],
    irpj_csll: float,
    cron_obj: dict,
    icms_uf: float,
    is_current: bool,
) -> list:
    """Gera os blocos de memória de cálculo para um regime."""
    elements = []

    # Título do regime
    current_badge = " (regime atual)" if is_current else ""
    elements.append(Paragraph(f"<b>{regime_nome}{current_badge}</b>", ST["h3"]))
    elements.append(Spacer(1, 4))

    fat_arg = faturamento_anual if regime_key in ("mei", "simples_nacional") else None

    # ── Sistema Atual ─────────────────────────────────────────────────────────
    try:
        res_atual = calcular_sistema_atual(
            valor, regime_key, setor_obj, uf, fat_arg,
            folha_pagamento_mensal, credito_entrada,
            _icms_uf=icms_uf,
        )
        detalhe_rows_a = [[
            Paragraph("Tributo", ST["cell_header_l"]),
            Paragraph("Alíq.", ST["cell_header"]),
            Paragraph("Fórmula de cálculo", ST["cell_header_l"]),
            Paragraph("Valor", ST["cell_header"]),
        ]]
        for d in res_atual.detalhes:
            aliq_txt = f"{d.aliquota_aplicada:.2f}%" if d.aliquota_aplicada else "—"
            formula_txt = d.formula or "—"
            row = [
                Paragraph(d.nome, ST["mem_nome"]),
                Paragraph(aliq_txt, ST["mem_aliq"]),
                Paragraph(formula_txt, ST["mem_formula"]),
                Paragraph(brl(d.valor), ST["mem_valor"]),
            ]
            detalhe_rows_a.append(row)
        # IRPJ/CSLL row
        if irpj_csll > 0:
            if regime_key == "lucro_presumido":
                tipo = setor_obj.get("tipo", "servico")
                pres = setor_obj.get("presuncao_irpj", 0.08 if tipo == "produto" else 0.32)
                pres_csll = setor_obj.get("presuncao_csll", 0.12 if tipo == "produto" else 0.32)
                irpj_formula = (
                    f"Pres. IRPJ {int(pres*100)}% × fat. × 15% "
                    f"+ Pres. CSLL {int(pres_csll*100)}% × fat. × 9%"
                )
            elif regime_key == "lucro_real":
                if despesas_mensais is not None:
                    lucro = faturamento_anual - despesas_mensais * 12
                    irpj_formula = f"Lucro anual est. {brl(lucro)} × 15% (IRPJ) + 9% (CSLL)"
                else:
                    irpj_formula = "Lucro real — informar despesas para estimativa"
            else:
                irpj_formula = "Incluído no DAS"
            detalhe_rows_a.append([
                Paragraph("IRPJ + CSLL (estimado)", ST["mem_nome"]),
                Paragraph("—", ST["mem_aliq"]),
                Paragraph(irpj_formula, ST["mem_formula"]),
                Paragraph(brl(irpj_csll), ST["mem_valor"]),
            ])
        total_atual = res_atual.total + irpj_csll
        detalhe_rows_a.append([
            Paragraph("TOTAL Sistema Atual", ST["cell_bold"]),
            Paragraph("", ST["mem_aliq"]),
            Paragraph("", ST["mem_formula"]),
            Paragraph(brl(total_atual), ST["mem_total"]),
        ])
        t_a = Table(detalhe_rows_a, colWidths=[4.2*cm, 1.8*cm, 8.5*cm, 2.5*cm])
        t_a.setStyle(_mem_table_style(INK_700))
        elements.append(Paragraph("Sistema Atual", ST["label"]))
        elements.append(Spacer(1, 2))
        elements.append(t_a)
    except Exception:
        elements.append(Paragraph("Dados insuficientes para calcular sistema atual.", ST["small"]))

    elements.append(Spacer(1, 8))

    # ── Sistema Novo ──────────────────────────────────────────────────────────
    try:
        res_novo = calcular_sistema_novo(
            valor, regime_key, setor_obj, uf, ano,
            credito_entrada, fat_arg, folha_pagamento_mensal,
            _cron=cron_obj, _icms_uf=icms_uf,
        )
        detalhe_rows_n = [[
            Paragraph("Tributo", ST["cell_header_l"]),
            Paragraph("Alíq.", ST["cell_header"]),
            Paragraph("Fórmula de cálculo", ST["cell_header_l"]),
            Paragraph("Valor", ST["cell_header"]),
        ]]
        sep_rows_n: list[int] = []
        for d in res_novo.detalhes:
            row_idx = len(detalhe_rows_n)
            aliq_txt = f"{d.aliquota_aplicada:.2f}%" if d.aliquota_aplicada else "—"
            formula_txt = d.formula or "—"
            if getattr(d, "separador", False):
                sep_rows_n.append(row_idx)
                row = [
                    Paragraph(f"= {d.nome}", ST["mem_nome"]),
                    Paragraph("—", ST["mem_aliq"]),
                    Paragraph(formula_txt, ST["mem_formula"]),
                    Paragraph(brl(d.valor), ST["mem_valor"]),
                ]
            elif d.informativo:
                row = [
                    Paragraph(d.nome + " [informativo]", ST["mem_info"]),
                    Paragraph(aliq_txt, ST["mem_aliq"]),
                    Paragraph(formula_txt, ST["mem_info"]),
                    Paragraph(brl(d.valor), ST["mem_info"]),
                ]
            else:
                row = [
                    Paragraph(d.nome, ST["mem_nome"]),
                    Paragraph(aliq_txt, ST["mem_aliq"]),
                    Paragraph(formula_txt, ST["mem_formula"]),
                    Paragraph(brl(d.valor), ST["mem_valor"]),
                ]
            detalhe_rows_n.append(row)
        if irpj_csll > 0:
            detalhe_rows_n.append([
                Paragraph("IRPJ + CSLL (estimado)", ST["mem_nome"]),
                Paragraph("—", ST["mem_aliq"]),
                Paragraph("Não alterado pela reforma tributária", ST["mem_formula"]),
                Paragraph(brl(irpj_csll), ST["mem_valor"]),
            ])
        total_novo = res_novo.total + irpj_csll
        detalhe_rows_n.append([
            Paragraph(f"TOTAL Novo Sistema ({ano})", ST["cell_bold"]),
            Paragraph("", ST["mem_aliq"]),
            Paragraph("", ST["mem_formula"]),
            Paragraph(brl(total_novo), ST["mem_total"]),
        ])
        t_n = Table(detalhe_rows_n, colWidths=[4.2*cm, 1.8*cm, 8.5*cm, 2.5*cm])
        t_n.setStyle(_mem_table_style(colors.HexColor("#059669"), sep_rows=sep_rows_n))
        elements.append(Paragraph(f"Sistema Novo ({ano})", ST["label"]))
        elements.append(Spacer(1, 2))
        elements.append(t_n)

        # Variação compacta
        diff = total_novo - (res_atual.total + irpj_csll) if 'res_atual' in dir() else 0.0
        try:
            diff = total_novo - (res_atual.total + irpj_csll)
            pct_diff = diff / (res_atual.total + irpj_csll) * 100 if (res_atual.total + irpj_csll) > 0 else 0.0
            prefix = "+" if diff > 0 else ""
            diff_style = ST["cell_red_r"] if diff > 0 else ST["cell_green_r"]
            var_data = [[
                Paragraph("Variação (novo vs atual)", ST["cell_bold"]),
                Paragraph(f"{prefix}{brl(diff)}", diff_style),
                Paragraph(f"{prefix}{pct_diff:.1f}%", diff_style),
            ]]
            var_t = Table(var_data, colWidths=[8.0*cm, 5.0*cm, 4.0*cm])
            var_t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), INK_50),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("BOX", (0, 0), (-1, -1), 0.3, INK_400),
            ]))
            elements.append(Spacer(1, 4))
            elements.append(var_t)
        except Exception:
            pass
    except Exception:
        elements.append(Paragraph("Dados insuficientes para calcular novo sistema.", ST["small"]))

    elements.append(Spacer(1, 8))
    return elements


# ─── Insight box ─────────────────────────────────────────────────────────────
def _insight_box(ST: dict, text: str,
                 border_color=None, bg=None) -> Table:
    """Caixa de destaque com borda esquerda colorida."""
    bc = border_color or EMERALD
    bg_c = bg or colors.HexColor("#ECFDF5")
    t = Table([[Paragraph(text, ST["body_j"])]], colWidths=[None])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), bg_c),
        ("LEFTPADDING",   (0, 0), (-1, -1), 14),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBEFORE",    (0, 0), (-1, -1), 4, bc),
    ]))
    return t


# ─── Seção Base Legal ─────────────────────────────────────────────────────────
def _base_legal_section(
    ST: dict,
    sec: int,
    setor_obj: dict,
    setor_nome: str,
    regime_key: str,
    uf: str,
    icms_uf: float,
) -> list:
    """Gera a seção de Base Legal adaptada ao setor e regime."""
    elements = []
    tipo = setor_obj.get("tipo", "servico")
    reducao = setor_obj.get("reducao_aliquota", 1.0)

    try:
        cron_2033 = get_cronograma(2033)
    except Exception:
        cron_2033 = {}
    cbs_ref = cron_2033.get("cbs_percentual", 0.088)
    ibs_ref = cron_2033.get("ibs_percentual", 0.192)

    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"{sec}. Base Legal", ST["h1"]),
        Paragraph(
            f"Fundamentos legais dos tributos analisados neste estudo, com as alíquotas aplicáveis "
            f"ao setor <b>{setor_nome}</b> e à UF <b>{uf}</b>.",
            ST["body_j"]),
        Spacer(1, 4),
    ]))

    rows_bl = [[
        Paragraph("Tributo", ST["cell_header_l"]),
        Paragraph("Legislação", ST["cell_header_l"]),
        Paragraph("Alíquota / Observação", ST["cell_header_l"]),
    ]]

    if tipo == "servico":
        rows_bl.append([
            Paragraph("<b>ISS</b>\nImposto Sobre Servicos de Qualquer Natureza", ST["cell_l"]),
            Paragraph("LC 116/2003\nLei municipal", ST["cell_l"]),
            Paragraph(
                "Alíquota entre 2% e 5%, fixada por lei do município do prestador. "
                "Calculado por dentro (integra o preco). Substituído progressivamente pelo IBS a partir de 2029.",
                ST["cell_l"]),
        ])
    else:
        rows_bl.append([
            Paragraph("<b>ICMS</b>\nImposto sobre Circulacao de Mercadorias e Servicos", ST["cell_l"]),
            Paragraph(f"CF/1988, Art. 155\nLC 87/1996\nLeg. estadual ({uf})", ST["cell_l"]),
            Paragraph(
                f"Alíquota interna {uf}: {pct(icms_uf*100, 0)}. Operacoes interestaduais: 7% ou 12%. "
                "Calculado por dentro (integra o preco). Substituído progressivamente pelo IBS a partir de 2029.",
                ST["cell_l"]),
        ])

    rows_bl.append([
        Paragraph("<b>PIS / COFINS</b>\nContribuicoes sobre a Receita Bruta", ST["cell_l"]),
        Paragraph("Lei 10.637/2002\nLei 10.833/2003", ST["cell_l"]),
        Paragraph(
            "Regime cumulativo (Lucro Presumido, Simples*): PIS 0,65% + COFINS 3,00% = 3,65% sobre receita.\n"
            "Regime nao cumulativo (Lucro Real): PIS 1,65% + COFINS 7,60%, com crédito de insumos.\n"
            "(*) No Simples Nacional, incluídos no DAS. Substituídos pela CBS a partir de 2027.",
            ST["cell_l"]),
    ])

    pres_irpj = setor_obj.get("presuncao_irpj", 0.08 if tipo == "produto" else 0.32)
    pres_csll = setor_obj.get("presuncao_csll", 0.12 if tipo == "produto" else 0.32)
    if regime_key in ("lucro_presumido", "lucro_real"):
        if regime_key == "lucro_presumido":
            irpj_txt = (
                f"Lucro Presumido: base presumida de {pct(pres_irpj*100, 0)} (IRPJ) e "
                f"{pct(pres_csll*100, 0)} (CSLL) da receita bruta.\n"
                "IRPJ: 15% + adicional de 10% sobre lucro > R$ 240.000/ano.\n"
                "CSLL: 9% sobre a base de cálculo presumida."
            )
        else:
            irpj_txt = (
                "Lucro Real: IRPJ 15% + adicional 10% sobre o lucro real apurado.\n"
                "CSLL: 9% sobre o lucro real. Permite compensacao de prejuízos (limite de 30% ao período).\n"
                f"Presuncao de referencia para estimativas: {pct(pres_irpj*100, 0)} (IRPJ), {pct(pres_csll*100, 0)} (CSLL)."
            )
    else:
        irpj_txt = "Incluído no DAS (Simples Nacional / MEI). Nao incide separadamente sobre o faturamento."

    rows_bl.append([
        Paragraph("<b>IRPJ / CSLL</b>\nImpostos sobre o Lucro", ST["cell_l"]),
        Paragraph("Decreto 9.580/2018\n(RIR/2018)\nLei 7.689/1988", ST["cell_l"]),
        Paragraph(irpj_txt, ST["cell_l"]),
    ])

    cbs_ef_pct = round(cbs_ref * reducao * 100, 2)
    ibs_ef_pct = round(ibs_ref * reducao * 100, 2)
    red_pct = int(round((1 - reducao) * 100))
    cbs_ibs_txt = (
        f"CBS substitui PIS/COFINS — vigencia plena a partir de 2027.\n"
        f"IBS substitui ISS/ICMS — transicao progressiva 2029 a 2032, vigencia plena em 2033.\n"
        f"Alíquotas de referencia (plenas, 2033): CBS {round(cbs_ref*100, 1)}%, IBS {round(ibs_ref*100, 1)}%.\n"
        f"Reducao setorial — {setor_nome}: {red_pct}%.\n"
        f"Alíquotas efetivas para este setor: CBS {cbs_ef_pct}%, IBS {ibs_ef_pct}%.\n"
        "Cobrados por fora (Art. 9.o, LC 214/2025): nao integram o preco da operacao."
    )
    rows_bl.append([
        Paragraph("<b>CBS / IBS</b>\nNovos Tributos — Reforma Tributária", ST["cell_l"]),
        Paragraph("EC 132/2023\nLC 214/2025\nArt. 9.o (por fora)", ST["cell_l"]),
        Paragraph(cbs_ibs_txt, ST["cell_l"]),
    ])

    t_bl = Table(rows_bl, colWidths=[4.2*cm, 3.8*cm, None])
    t_bl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, INK_50]),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.3, INK_100),
        ("BOX",           (0, 0), (-1, -1), 0.5, INK_400),
    ]))
    elements.append(t_bl)
    return elements


# ─── DRE Simulada ────────────────────────────────────────────────────────────
def _dre_section(
    ST: dict,
    sec: int,
    regime_key: str,
    regime_nome: str,
    setor_obj: dict,
    uf: str,
    ano: int,
    valor_base: float,
    faturamento_anual: float,
    despesas_mensais: Optional[float],
    irpj_csll_estimado: float,
    credito_entrada: float,
    folha_pagamento_mensal: Optional[float],
    cron_obj: dict,
    icms_uf: float,
) -> list:
    """DRE simplificada comparando sistema atual vs novo sistema."""
    elements = []
    if valor_base <= 0 or faturamento_anual <= 0:
        return elements

    scaling = faturamento_anual / valor_base
    fat_arg = faturamento_anual if regime_key in ("mei", "simples_nacional") else None

    try:
        res_a = calcular_sistema_atual(
            valor_base, regime_key, setor_obj, uf, fat_arg,
            folha_pagamento_mensal, credito_entrada, _icms_uf=icms_uf,
        )
        res_n = calcular_sistema_novo(
            valor_base, regime_key, setor_obj, uf, ano,
            credito_entrada, fat_arg, folha_pagamento_mensal,
            _cron=cron_obj, _icms_uf=icms_uf,
        )
    except Exception:
        return elements

    # Separar CBS/IBS (por fora) do residual por dentro no novo sistema
    cbs_ibs_op = sum(
        d.valor for d in res_n.detalhes
        if not d.informativo
        and not getattr(d, "separador", False)
        and (d.nome.startswith("CBS") or d.nome.startswith("IBS"))
    )
    residual_op = res_n.total - cbs_ibs_op

    # Valores anuais
    tributos_atuais_anual = res_a.total * scaling
    cbs_ibs_anual         = cbs_ibs_op   * scaling
    residual_anual        = residual_op   * scaling
    irpj_csll_anual       = irpj_csll_estimado * scaling
    custos_anuais         = despesas_mensais * 12 if despesas_mensais is not None else None

    receita_bruta      = faturamento_anual
    receita_liq_atual  = receita_bruta - tributos_atuais_anual
    receita_liq_nova   = receita_bruta - residual_anual   # CBS/IBS sao por fora

    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"{sec}. Demonstração do Resultado — Impacto da Reforma", ST["h1"]),
        Paragraph(
            f"DRE simplificada para o <b>{regime_nome}</b> com faturamento anual de "
            f"<b>{brl(faturamento_anual)}</b>. No novo sistema, CBS e IBS sao cobrados por fora "
            f"(Art. 9.o, LC 214/2025): nao reduzem a Receita Líquida, mas representam "
            "uma obrigacao tributária separada paga via Split Payment.",
            ST["body_j"]),
        Spacer(1, 4),
    ]))

    def _fmtv(v: float | None) -> str:
        if v is None:
            return "—"
        if v < 0:
            return f"({brl(-v)})"
        return brl(v)

    BLUE_BG = colors.HexColor("#EFF6FF")
    dre_data: list = [[
        Paragraph("Item", ST["cell_header_l"]),
        Paragraph("Sistema Atual", ST["cell_header"]),
        Paragraph(f"Novo Sistema ({ano})", ST["cell_header"]),
    ]]
    sub_rows: list[int] = []

    def _add(label: str, val_a: float | None, val_n: float | None,
             is_sub: bool = False, indent: bool = False) -> None:
        if is_sub:
            sub_rows.append(len(dre_data))
        pfx = "    " if indent else ""
        sl = ST["cell_bold"] if is_sub else ST["cell_l"]
        sv = ST["cell_bold_r"] if is_sub else ST["cell_r"]
        dre_data.append([
            Paragraph(pfx + label, sl),
            Paragraph(_fmtv(val_a), sv),
            Paragraph(_fmtv(val_n), sv),
        ])

    _add("(+) Receita Bruta de Servicos / Vendas", receita_bruta, receita_bruta)
    _add(f"(-) Tributos sobre Receita (por dentro)", tributos_atuais_anual, residual_anual)
    _add("(=) Receita Líquida", receita_liq_atual, receita_liq_nova, is_sub=True)

    if cbs_ibs_anual > 0.01:
        _add(f"(-) CBS + IBS (por fora — Split Payment)", 0.0, cbs_ibs_anual)

    if custos_anuais is not None:
        _add("(-) Custos e Despesas Operacionais (est.)", custos_anuais, custos_anuais)
        lajir_a = receita_liq_atual - custos_anuais
        lajir_n = receita_liq_nova - cbs_ibs_anual - custos_anuais
        _add("(=) LAJIR — antes de IRPJ/CSLL (est.)", lajir_a, lajir_n, is_sub=True)
        if irpj_csll_anual > 0:
            _add("(-) IRPJ + CSLL (estimado)", irpj_csll_anual, irpj_csll_anual)
        _add("(=) Resultado Líquido Estimado",
             lajir_a - irpj_csll_anual,
             lajir_n - irpj_csll_anual, is_sub=True)
    else:
        if irpj_csll_anual > 0:
            _add("(-) IRPJ + CSLL (estimado)", irpj_csll_anual, irpj_csll_anual)
        _add("(=) Resultado antes de Despesas (est.)",
             receita_liq_atual - irpj_csll_anual,
             receita_liq_nova - cbs_ibs_anual - irpj_csll_anual, is_sub=True)

    cmds = [
        ("BACKGROUND",    (0, 0), (-1, 0), BRAND),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, INK_50]),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.3, INK_100),
        ("BOX",           (0, 0), (-1, -1), 0.5, INK_400),
    ]
    for r in sub_rows:
        cmds.extend([
            ("BACKGROUND", (0, r), (-1, r), BLUE_BG),
            ("FONTNAME",   (0, r), (-1, r), "Helvetica-Bold"),
            ("LINEABOVE",  (0, r), (-1, r), 0.6, BRAND),
            ("LINEBELOW",  (0, r), (-1, r), 0.6, BRAND),
        ])

    t_dre = Table(dre_data, colWidths=[9.0*cm, 3.75*cm, 3.75*cm])
    t_dre.setStyle(TableStyle(cmds))
    elements.append(t_dre)

    elements.append(Spacer(1, 4))
    if despesas_mensais is None:
        elements.append(Paragraph(
            "Informe as despesas mensais no formulário para exibir LAJIR e Resultado Líquido.",
            ST["small"]))
    elements.append(Paragraph(
        "<b>Nota:</b> No novo sistema, CBS e IBS sao recolhidos via Split Payment — o banco debita "
        "automaticamente no recebimento e repassa ao governo. A Receita Líquida aumenta (ISS, ICMS, "
        "PIS e COFINS deixam de incidir), mas o fluxo de caixa deve considerar a obrigacao de CBS+IBS. "
        "IRPJ e CSLL nao sao alterados pela Reforma Tributária. Valores estimados.",
        ST["small_j"]))

    return elements


# ─── Análise por Regime ───────────────────────────────────────────────────────
def _analise_regimes_section(
    ST: dict,
    sec: int,
    comp,
    setor_obj: dict,
    inp,
) -> list:
    """Seção de análise narrativa por regime, do mais ao menos vantajoso."""
    elements = []
    tipo = setor_obj.get("tipo", "servico")
    reducao = setor_obj.get("reducao_aliquota", 1.0)
    red_pct = int(round((1 - reducao) * 100))
    tipo_trib = "ISS" if tipo == "servico" else "ICMS"

    try:
        c33 = get_cronograma(2033)
        cbs_ef = round(c33.get("cbs_percentual", 0.088) * reducao * 100, 2)
        ibs_ef = round(c33.get("ibs_percentual", 0.192) * reducao * 100, 2)
    except Exception:
        cbs_ef, ibs_ef = 8.8, 19.2

    disponiveis = [r for r in comp.comparativo if r.disponivel]
    melhor_key  = comp.regime_mais_vantajoso
    sorted_disp = sorted(disponiveis, key=lambda x: x.total_novo or float("inf"))

    if not sorted_disp:
        return elements

    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"{sec}. Análise por Regime Tributário", ST["h1"]),
        Paragraph(
            f"Avaliação das características e do impacto da reforma para cada regime disponível "
            f"aplicado ao setor <b>{comp.setor}</b> ({comp.uf}), ordenados do mais ao menos "
            f"vantajoso no novo sistema em {comp.ano}.",
            ST["body_j"]),
        Spacer(1, 4),
    ]))

    for i, r in enumerate(sorted_disp):
        is_best = r.regime == melhor_key
        diff = r.diferenca or 0
        diff_prefix = "+" if diff > 0 else ""
        diff_sty = ST["cell_red_r"] if diff > 0 else ST["cell_green_r"]
        val_sty = ST["cell_green_r"] if is_best else ST["cell_bold_r"]

        kpi_rows = [
            [Paragraph("Sistema Atual", ST["label"]),
             Paragraph(f"Novo Sistema ({comp.ano})", ST["label"]),
             Paragraph("Variação", ST["label"])],
            [Paragraph(brl(r.total_atual or 0), ST["cell_bold_r"]),
             Paragraph(brl(r.total_novo  or 0), val_sty),
             Paragraph(f"{diff_prefix}{brl(diff)}", diff_sty)],
        ]
        kpi_t = Table(kpi_rows, colWidths=[5.5*cm, 5.5*cm, 5.5*cm])
        kpi_t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), INK_100),
            ("BACKGROUND",    (0, 1), (-1, 1), WHITE),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("LINEBELOW",     (0, 0), (-1, 0), 0.3, INK_400),
            ("LINEAFTER",     (0, 0), (1, -1), 0.3, INK_100),
            ("BOX",           (0, 0), (-1, -1), 0.3, INK_400),
        ]))

        # Narrativa especifica por regime
        pres_irpj = setor_obj.get("presuncao_irpj", 0.08 if tipo == "produto" else 0.32)
        cbs_ibs_total = f"CBS {cbs_ef}% + IBS {ibs_ef}%"
        red_nota = f" (reducao setorial de {red_pct}% aplicada)" if red_pct > 0 else ""

        if r.regime == "lucro_presumido":
            narrativa = (
                f"No Lucro Presumido, PIS/COFINS incidem no regime cumulativo (3,65%) sem aproveitamento "
                f"de créditos, e {tipo_trib} compoe a carga atual de {pct(r.percentual_atual or 0)} sobre "
                f"a operacao. IRPJ e CSLL sao estimados sobre presuncao de {int(pres_irpj*100)}% da receita. "
                f"Com a reforma, {tipo_trib}, PIS e COFINS sao substituídos progressivamente por CBS e IBS. "
                f"Em 2033, a alíquota efetiva neste setor sera {cbs_ibs_total}{red_nota}, "
                "cobrados por fora via Split Payment."
            )
        elif r.regime == "lucro_real":
            narrativa = (
                f"No Lucro Real, PIS/COFINS sao nao cumulativos (9,25%), com crédito integral de insumos. "
                f"IRPJ e CSLL incidem somente sobre o lucro apurado — zerados em cenário de prejuízo. "
                f"Com a reforma, o Lucro Real mantem o aproveitamento de créditos de CBS/IBS "
                f"(regime nao cumulativo por natureza). Em 2033, alíquotas efetivas: {cbs_ibs_total}{red_nota}. "
                f"O crédito de entrada informado de {int(inp.credito_entrada*100)}% reduz a carga líquida de CBS/IBS."
            )
        elif r.regime == "simples_nacional":
            narrativa = (
                f"No Simples Nacional, todos os tributos sao recolhidos em DAS único, com alíquota "
                f"determinada pela faixa de faturamento ({brl(inp.faturamento_anual)}/ano). "
                "Com a reforma, as regras de CBS/IBS no Simples serao definidas pelo Comitê Gestor do IBS. "
                "O Simples Híbrido — opcional — permite destacar CBS/IBS na nota para gerar crédito a clientes PJ, "
                "ao custo de maior carga tributária."
            )
        elif r.regime == "mei":
            over_limit = inp.faturamento_anual > 81_000
            faturamento_note = (
                f"O faturamento informado ({brl(inp.faturamento_anual)}) supera o limite do MEI "
                "(R$ 81.000/ano) — a migracão para Simples Nacional ou Lucro Presumido é obrigatória."
                if over_limit else
                f"O faturamento informado ({brl(inp.faturamento_anual)}) está dentro do limite do MEI (R$ 81.000/ano)."
            )
            narrativa = (
                f"O MEI recolhe tributos em valor fixo mensal (DAS-MEI). {faturamento_note} "
                "Com a reforma, as regras de CBS/IBS para o MEI ainda serao definidas pelo CG-IBS."
            )
        else:
            narrativa = (
                f"Carga atual: {pct(r.percentual_atual or 0)} | "
                f"Carga no novo sistema ({comp.ano}): {pct(r.percentual_novo or 0)}."
            )

        block = [
            Spacer(1, 8 if i > 0 else 2),
            Paragraph(f"<b>{r.nome}</b>", ST["h3"]),
        ]
        if is_best:
            block.append(Paragraph("Regime recomendado no novo sistema", ST["badge_ok"]))
        block += [Spacer(1, 3), kpi_t]
        elements.append(KeepTogether(block))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(narrativa, ST["body_j"]))

    return elements


# ─── Template customizado para TOC ───────────────────────────────────────────
class _EstudoDoc(SimpleDocTemplate):
    """SimpleDocTemplate que emite notificacoes de TOC para nossos estilos H1."""

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            sn = flowable.style.name
            if sn == "H1":
                self.notify("TOCEntry", (0, flowable.getPlainText(), self.page, None))
            elif sn in ("H2", "H3"):
                self.notify("TOCEntry", (1, flowable.getPlainText(), self.page, None))


# ─── Cronograma Timeline ──────────────────────────────────────────────────────
def _cronograma_timeline_section(ST: dict, sec: int, setor_obj: dict | None, icms_uf: float) -> list:
    elements = []
    reducao  = (setor_obj or {}).get("reducao_aliquota", 1.0)
    tipo     = (setor_obj or {}).get("tipo", "servico")
    tipo_trib = "ISS" if tipo == "servico" else "ICMS"
    red_pct  = int(round((1 - reducao) * 100))
    setor_nome = (setor_obj or {}).get("nome", "analisado")

    CBS33, IBS33 = 0.088, 0.192
    cbs_ef = round(CBS33 * reducao * 100, 2)
    ibs_ef = round(IBS33 * reducao * 100, 2)
    total_ef = round((CBS33 + IBS33) * reducao * 100, 2)

    def ibs_yr(fator: float) -> str:
        return f"{round(IBS33 * fator * reducao * 100, 2):.2f}%"

    # Inline styles para as células do timeline
    yh = ParagraphStyle("_yh", fontName="Helvetica-Bold", fontSize=11,
                        textColor=WHITE, leading=14, alignment=TA_CENTER)
    yt = ParagraphStyle("_yt", fontName="Helvetica-Bold", fontSize=7.5,
                        textColor=INK_900, leading=10, alignment=TA_CENTER)
    yd = ParagraphStyle("_yd", fontName="Helvetica", fontSize=6.5,
                        textColor=INK_600, leading=9, alignment=TA_CENTER)
    yi = ParagraphStyle("_yi", fontName="Helvetica-Bold", fontSize=6.5,
                        textColor=WHITE, leading=9, alignment=TA_CENTER)
    yl = ParagraphStyle("_yl", fontName="Helvetica-Bold", fontSize=7.5,
                        textColor=INK_700, leading=10, alignment=TA_CENTER)

    # (ano, titulo_curto, descricao, impacto_cliente, cor_cabecalho)
    yr_info = [
        ("2026", "Fase de Testes",
         f"CBS 0,9% e IBS 0,1%\nnos doc. fiscais.\nSem carga adicional\nreal.",
         f"Adequar NFs e\nsistemas para\ndestaque de CBS/IBS.",
         colors.HexColor("#0D2340")),
        ("2027", "CBS Plena",
         f"PIS e COFINS\nextintos. CBS a\n{cbs_ef:.2f}% ef. via\nSplit Payment.",
         f"CBS {cbs_ef:.2f}% ef.\n{tipo_trib} mantido\nintegralmente.",
         colors.HexColor("#0B6E68")),
        ("2028", "Adaptacao",
         f"{tipo_trib} e ISS\nmantidos integrais.\nIBS 0,1% (teste).\nAnno de ajustes.",
         f"Adaptar ERP,\ncontratos e\nprecificacao.",
         colors.HexColor("#0E9080")),
        ("2029", "10% IBS",
         f"{tipo_trib} reduzido\nem 10%. IBS a\n10% da aliquota\nde referencia.",
         f"{tipo_trib} a 90%.\nIBS {ibs_yr(0.1)} ef.",
         colors.HexColor("#2D8A40")),
        ("2030", "20% IBS",
         f"{tipo_trib} reduzido\nem 20%. IBS a\n20% da aliquota\nde referencia.",
         f"{tipo_trib} a 80%.\nIBS {ibs_yr(0.2)} ef.",
         colors.HexColor("#6BA83A")),
        ("2031", "30% IBS",
         f"{tipo_trib} reduzido\nem 30%. IBS a\n30% da aliquota\nde referencia.",
         f"{tipo_trib} a 70%.\nIBS {ibs_yr(0.3)} ef.",
         colors.HexColor("#C87C14")),
        ("2032", "40% IBS",
         f"{tipo_trib} reduzido\nem 40%. IBS a\n40% da aliquota\nde referencia.",
         f"{tipo_trib} a 60%.\nIBS {ibs_yr(0.4)} ef.",
         colors.HexColor("#BE5010")),
        ("2033", "IVA Dual Pleno",
         f"ICMS e ISS\nextintos. CBS e\nIBS em vigor\npleno.",
         f"CBS {cbs_ef:.2f}% +\nIBS {ibs_ef:.2f}% =\n{total_ef:.2f}% ef.",
         colors.HexColor("#0D2340")),
    ]

    COL_W = [2.0*cm, 2.1*cm, 2.1*cm, 1.85*cm, 1.85*cm, 1.85*cm, 1.85*cm, 2.2*cm]

    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"{sec}. Cronograma da Transicao Tributaria (2026-2033)", ST["h1"]),
        Spacer(1, 3),
        Paragraph(
            f"Marcos e eventos da Reforma Tributaria conforme LC 214/2025 e EC 132/2023. "
            + (f"Para o setor <b>{setor_nome}</b>, a reducao de <b>{red_pct}%</b> nas aliquotas "
               f"ja e refletida na linha 'Impacto para a empresa'."
               if red_pct > 0 else
               "Cada fase indica o evento principal, as mudancas nos tributos vigentes e o impacto estimado para esta empresa."),
            ST["body_j"]),
        Spacer(1, 6),
    ]))

    # Linha 0: "TRANSICAO GRADUAL" spanning cols 3-6
    row0 = [Paragraph("", yl) for _ in range(8)]
    row0[3] = Paragraph("TRANSICAO GRADUAL", yl)

    row1 = [Paragraph(yi_[0], yh) for yi_ in yr_info]          # anos (coloridos)
    row2 = [Paragraph(yi_[1], yt) for yi_ in yr_info]          # titulo evento
    row3 = [Paragraph(yi_[2].replace("\n", "<br/>"), yd) for yi_ in yr_info]  # descricao
    row4 = [Paragraph(yi_[3].replace("\n", "<br/>"), yi) for yi_ in yr_info]  # impacto

    table_data = [row0, row1, row2, row3, row4]

    ts_cmds = [
        ("SPAN",          (3, 0), (6, 0)),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 2),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 2),
        # Linha 0: so o label TRANSICAO GRADUAL
        ("BACKGROUND",    (0, 0), (-1, 0), WHITE),
        ("LINEBELOW",     (3, 0), (6, 0), 1.5, colors.HexColor("#2D8A40")),
        # Linhas 2-3: titulo e descricao
        ("BACKGROUND",    (0, 2), (-1, 2), WHITE),
        ("BACKGROUND",    (0, 3), (-1, 3), INK_50),
        ("TOPPADDING",    (0, 2), (-1, 3), 5),
        ("BOTTOMPADDING", (0, 2), (-1, 3), 5),
        ("TOPPADDING",    (0, 4), (-1, 4), 5),
        ("BOTTOMPADDING", (0, 4), (-1, 4), 5),
        ("TOPPADDING",    (0, 1), (-1, 1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
        # Bordas
        ("BOX",           (0, 1), (-1, -1), 0.4, INK_400),
        ("INNERGRID",     (0, 2), (-1, 3), 0.3, INK_100),
        ("LINEBELOW",     (0, 1), (-1, 1), 0, WHITE),
        ("LINEBELOW",     (0, 3), (-1, 3), 0.5, INK_400),
    ]

    # Cor de cabecalho e impacto por coluna
    for col, yi_ in enumerate(yr_info):
        ts_cmds.append(("BACKGROUND", (col, 1), (col, 1), yi_[4]))
        ts_cmds.append(("BACKGROUND", (col, 4), (col, 4), yi_[4]))

    cron_tbl = Table(table_data, colWidths=COL_W)
    cron_tbl.setStyle(TableStyle(ts_cmds))
    elements.append(cron_tbl)

    elements.append(Spacer(1, 3))
    elements.append(Paragraph(
        f"(*) Aliquotas CBS (8,8%) e IBS (19,2%) sao referencias provisorias, "
        f"sujeitas a confirmacao por Resolucao do Senado (LC 214/2025, Art. 361)."
        + (f" Setor com reducao de {red_pct}%: CBS {cbs_ef:.2f}% + IBS {ibs_ef:.2f}% = {total_ef:.2f}% ef."
           if red_pct > 0 else ""),
        ST["small_j"]))

    return elements


# ─── Secao O que Muda ─────────────────────────────────────────────────────────
def _reforma_section(
    ST: dict,
    sec: int,
    comp,
    setor_obj: dict | None,
    inp,
    melhor_key: str | None,
    icms_uf: float,
) -> list:
    elements = []
    so = setor_obj or {}
    tipo      = so.get("tipo", "servico")
    reducao   = so.get("reducao_aliquota", 1.0)
    red_pct   = int(round((1 - reducao) * 100))
    tipo_trib = "ISS" if tipo == "servico" else "ICMS"
    setor_nome = so.get("nome", comp.setor)

    CBS33, IBS33 = 0.088, 0.192
    cbs_ef_dec  = CBS33 * reducao
    ibs_ef_dec  = IBS33 * reducao
    cbs_ef_pct  = round(cbs_ef_dec * 100, 2)
    ibs_ef_pct  = round(ibs_ef_dec * 100, 2)
    total_ef_pct = round((cbs_ef_dec + ibs_ef_dec) * 100, 2)

    fat_mensal  = inp.faturamento_anual / 12
    split_bruto = fat_mensal * (cbs_ef_dec + ibs_ef_dec)
    split_cred  = split_bruto * inp.credito_entrada
    split_liq   = split_bruto - split_cred

    regime_nome   = _REGIME_LABEL.get(inp.regime_atual or "", "Regime atual")
    melhor_nome_r = _REGIME_LABEL.get(melhor_key or inp.regime_atual or "", regime_nome)

    pis_r = 0.0065 if inp.regime_atual == "lucro_presumido" else 0.0165
    cof_r = 0.030  if inp.regime_atual == "lucro_presumido" else 0.076
    trib_r = so.get("iss_padrao", 0.03) if tipo == "servico" else icms_uf

    # ── CABECALHO ───────────────────────────────────────────────────────────
    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"{sec}. O que Muda com a Reforma Tributaria", ST["h1"]),
        Spacer(1, 3),
        Paragraph(
            f"A Reforma Tributaria (LC 214/2025 e EC 132/2023) institui o maior redesenho do "
            f"sistema fiscal brasileiro em decadas. Este capitulo analisa, de forma objetiva, "
            f"as principais mudancas que impactam <b>{inp.razao_social}</b>: quais tributos sao "
            f"substituidos, como funciona o novo sistema, os efeitos no fluxo de caixa e os "
            f"pontos criticos a acompanhar ate 2033.",
            ST["body_j"]),
        Spacer(1, 6),
    ]))

    # ── 1. TRIBUTOS SUBSTITUIDOS ─────────────────────────────────────────────
    elements.append(KeepTogether([
        Spacer(1, 4),
        Paragraph("Tributos Substituidos e Novos Tributos", ST["h3"]),
        Spacer(1, 3),
    ]))
    hdr = [
        Paragraph("Tributo atual", ST["cell_header_l"]),
        Paragraph("Tipo", ST["cell_header"]),
        Paragraph("Aliquota ref.", ST["cell_header"]),
        Paragraph("Substituto", ST["cell_header"]),
        Paragraph("Aliquota ef. (2033)", ST["cell_header"]),
        Paragraph("Extincao", ST["cell_header"]),
    ]
    sub_rows = [hdr, [
        Paragraph("<b>PIS</b>", ST["cell_bold"]),
        Paragraph("Federal", ST["cell_l"]),
        Paragraph(f"{pis_r*100:.2f}%", ST["cell_r"]),
        Paragraph("<b>CBS</b>", ST["cell_bold"]),
        Paragraph(f"{cbs_ef_pct:.2f}%*", ST["cell_green_r"]),
        Paragraph("31/12/2026", ST["cell_r"]),
    ], [
        Paragraph("<b>COFINS</b>", ST["cell_bold"]),
        Paragraph("Federal", ST["cell_l"]),
        Paragraph(f"{cof_r*100:.1f}%", ST["cell_r"]),
        Paragraph("<b>CBS</b> (compartilhada)", ST["cell_l"]),
        Paragraph("(inclusa acima)", ST["cell_r"]),
        Paragraph("31/12/2026", ST["cell_r"]),
    ], [
        Paragraph(f"<b>{tipo_trib}</b>", ST["cell_bold"]),
        Paragraph("Est./Municipal" if tipo == "servico" else "Estadual", ST["cell_l"]),
        Paragraph(f"{trib_r*100:.1f}%", ST["cell_r"]),
        Paragraph("<b>IBS</b>", ST["cell_bold"]),
        Paragraph(f"{ibs_ef_pct:.2f}%*", ST["cell_green_r"]),
        Paragraph("31/12/2032", ST["cell_r"]),
    ]]
    t_sub = Table(sub_rows, colWidths=[2.8*cm, 2.5*cm, 2.4*cm, 3.6*cm, 3.2*cm, 2.4*cm])
    t_sub.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, INK_50, WHITE]),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.3, INK_100),
        ("BOX",           (0, 0), (-1, -1), 0.3, INK_400),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_sub)
    if red_pct > 0:
        elements.append(Spacer(1, 3))
        elements.append(Paragraph(
            f"(*) Reducao de <b>{red_pct}%</b> nas aliquotas de CBS e IBS para o setor "
            f"<b>{setor_nome}</b>, conforme LC 214/2025, Arts. 130-133 (Anexo III). "
            f"CBS: 8,8% reduzida para {cbs_ef_pct}%; IBS: 19,2% reduzida para {ibs_ef_pct}%.",
            ST["small_j"]))

    # ── 2. CBS ──────────────────────────────────────────────────────────────
    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph("CBS — Contribuicao sobre Bens e Servicos (Federal)", ST["h3"]),
        Spacer(1, 3),
        Paragraph(
            f"A CBS e o novo tributo federal que substitui o PIS e a COFINS a partir de 2027. "
            f"Sua principal diferenca estrutural e a <b>nao cumulatividade plena</b>: toda compra, "
            f"contratacao de servico ou aquisicao de ativo ligada a atividade gera credito de CBS, "
            f"que reduz o imposto a pagar no periodo — eliminando o efeito cascata do sistema atual."
            + (f" Para o setor <b>{setor_nome}</b>, a aliquota de referencia de 8,8% e reduzida "
               f"em {red_pct}%, resultando em aliquota efetiva de <b>{cbs_ef_pct}%</b>."
               if red_pct > 0 else
               f" A aliquota de referencia da CBS para este setor e <b>{cbs_ef_pct}%</b>.")
            + f" O recolhimento ocorre via <b>Split Payment</b>: a CBS e retida automaticamente "
              f"pelo sistema bancario no momento do recebimento, antes de o valor liquido "
              f"chegar a conta da empresa.",
            ST["body_j"]),
    ]))

    # ── 3. IBS ──────────────────────────────────────────────────────────────
    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"IBS — Imposto sobre Bens e Servicos (substitui {tipo_trib})", ST["h3"]),
        Spacer(1, 3),
        Paragraph(
            f"O IBS substitui o {tipo_trib} e passa a ser gerido pelo Comite Gestor do IBS (CG-IBS), "
            f"com aliquota de referencia de 19,2% compartilhada entre estados e municipios. "
            + (f"Com a reducao setorial de {red_pct}%, a aliquota efetiva para <b>{setor_nome}</b> e "
               f"<b>{ibs_ef_pct}%</b>."
               if red_pct > 0 else
               f"A aliquota efetiva para este setor e <b>{ibs_ef_pct}%</b>.")
            + f" A transicao e gradual entre 2029 e 2032: o {tipo_trib} e reduzido em 10 pontos "
              f"percentuais ao ano enquanto o IBS cresce proporcionalmente. "
              f"Em 2033, o {tipo_trib} e extinto definitivamente. "
              f"O IBS segue a mesma logica nao cumulativa da CBS, com credito sobre aquisicoes e servicos.",
            ST["body_j"]),
    ]))

    # ── 4. NAO CUMULATIVIDADE ────────────────────────────────────────────────
    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph("Nao Cumulatividade e Creditos de CBS/IBS", ST["h3"]),
        Spacer(1, 3),
    ]))
    if inp.regime_atual == "lucro_presumido":
        nao_cum_txt = (
            f"No <b>Lucro Presumido</b> atual, PIS (0,65%) e COFINS (3%) sao <b>cumulativos</b>: "
            f"nao ha credito sobre compras ou despesas. A partir de 2027, a CBS sera "
            f"estruturalmente nao cumulativa mesmo para empresas do LP. "
            f"Compras, servicos contratados, aluguel e equipamentos utilizados na atividade "
            f"poderao gerar credito de CBS/IBS, reduzindo o imposto a pagar. "
            f"O percentual de credito de entrada informado neste estudo e "
            f"<b>{int(inp.credito_entrada*100)}%</b>. "
            f"Empresas com alto volume de entradas tributaveis tendem a se beneficiar "
            f"dessa transicao do regime cumulativo para o nao cumulativo."
        )
    elif inp.regime_atual == "lucro_real":
        nao_cum_txt = (
            f"No <b>Lucro Real</b>, PIS (1,65%) e COFINS (7,6%) ja sao nao cumulativos. "
            f"A CBS segue a mesma logica: credito sobre aquisicoes de insumos, servicos e ativos. "
            f"O IBS funciona de forma identica ao substituir o {tipo_trib}. "
            f"O impacto liquido depende do saldo entre debitos (CBS/IBS sobre vendas) e creditos "
            f"(CBS/IBS sobre compras e servicos). O credito de entrada informado e "
            f"<b>{int(inp.credito_entrada*100)}%</b>: quanto maior esse percentual, "
            f"menor a carga liquida de CBS/IBS a recolher."
        )
    elif inp.regime_atual == "simples_nacional":
        nao_cum_txt = (
            f"No <b>Simples Nacional</b>, PIS e COFINS ja estao incorporados ao DAS. "
            f"As regras de CBS/IBS para o Simples ainda serao definidas pelo CG-IBS. "
            f"A tendencia e incorporacao ao DAS, mas existe a opcao do <b>Simples Hibrido</b>: "
            f"destaque opcional de CBS/IBS na NF para gerar credito ao comprador PJ, "
            f"ao custo de aliquota maior sobre essas operacoes. "
            f"Empresas com clientes predominantemente B2B devem avaliar essa opcao. "
            f"Em 2026, optantes do Simples estao dispensados do CBS/IBS-teste (Art. 350 LC 214/2025)."
        )
    elif inp.regime_atual == "mei":
        nao_cum_txt = (
            f"Para o <b>MEI</b>, as regras de CBS/IBS ainda serao regulamentadas pelo CG-IBS. "
            f"O DAS-MEI provavelmente incorporara CBS/IBS de forma simplificada. "
            f"Atentar ao limite de faturamento de R$ 81.000/ano: se superado, a migracao "
            f"para Simples Nacional e obrigatoria."
        )
    else:
        nao_cum_txt = (
            "O novo sistema e integralmente nao cumulativo: cada etapa da cadeia recolhe "
            "CBS/IBS apenas sobre o valor que efetivamente agregou, abatendo os creditos "
            "das etapas anteriores e eliminando o efeito cascata."
        )
    elements.append(Paragraph(nao_cum_txt, ST["body_j"]))

    # ── 5. SPLIT PAYMENT ─────────────────────────────────────────────────────
    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph("Split Payment — Impacto no Fluxo de Caixa", ST["h3"]),
        Spacer(1, 3),
        Paragraph(
            f"O <b>Split Payment</b> e o mecanismo pelo qual CBS e IBS sao retidos automaticamente "
            f"pelo sistema bancario ou pela plataforma de pagamento no momento da transacao, "
            f"antes de o valor liquido ser creditado na conta da empresa. "
            f"Na pratica, a empresa recebe o valor <b>ja liquido</b> de CBS/IBS, sem a "
            f"possibilidade de usar esse recurso temporariamente antes do recolhimento — "
            f"como ocorre hoje com PIS, COFINS e {tipo_trib}. "
            f"Esse mecanismo exige revisao do capital de giro e do fluxo de caixa operacional "
            f"antes de 2027.",
            ST["body_j"]),
        Spacer(1, 4),
    ]))
    sp_rows = [
        [Paragraph("Faturamento mensal estimado", ST["cell_l"]),
         Paragraph(brl(fat_mensal), ST["cell_bold_r"])],
        [Paragraph(f"x Aliquota efetiva CBS ({cbs_ef_pct}%) + IBS ({ibs_ef_pct}%) = {total_ef_pct}%",
                   ST["cell_l"]),
         Paragraph(brl(split_bruto), ST["cell_r"])],
    ]
    if inp.credito_entrada > 0:
        sp_rows.append([
            Paragraph(f"(-) Creditos de entrada estimados ({int(inp.credito_entrada*100)}%)",
                      ST["cell_l"]),
            Paragraph(f"({brl(split_cred)})", ST["cell_r"]),
        ])
    sp_rows.append([
        Paragraph("<b>Retencao via Split Payment em 2033 (sistema pleno)</b>", ST["cell_bold"]),
        Paragraph(f"<b>{brl(split_liq)}/mes</b>", ST["cell_bold_r"]),
    ])
    t_sp = Table(sp_rows, colWidths=[12.5*cm, 4.0*cm])
    t_sp.setStyle(TableStyle([
        ("LINEBELOW",     (0, 0), (-1, -2), 0.3, INK_100),
        ("LINEABOVE",     (0, -1), (-1, -1), 0.5, INK_400),
        ("BACKGROUND",    (0, -1), (-1, -1), INK_50),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("BOX",           (0, 0), (-1, -1), 0.3, INK_400),
    ]))
    elements.append(t_sp)
    elements.append(Spacer(1, 3))
    elements.append(Paragraph(
        "(*) Projecao para 2033 (sistema pleno) com aliquotas de referencia provisorias. "
        "Em 2027, apenas CBS entra em vigor. O IBS comeca em 2029. "
        "O capital de giro deve ser revisado antes do inicio de 2027.",
        ST["small_j"]))

    # ── 6. OBRIGACOES ACESSORIAS ─────────────────────────────────────────────
    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph("Novas Obrigacoes Acessorias e Adaptacoes Operacionais", ST["h3"]),
        Spacer(1, 3),
    ]))
    obrig = [
        ("<b>Nota Fiscal com CBS e IBS discriminados:</b> a partir de 2027, toda NF devera "
         "destacar separadamente os valores de CBS e IBS — requisito legal para que compradores "
         "aproveitem como credito tributario. Erros na discriminacao impedem o credito do comprador "
         "e podem gerar conflito comercial."),
        ("<b>EFD CBS/IBS (nova escrituracao digital):</b> substituira o SPED PIS/COFINS "
         "e parte do SPED ICMS. Periodicidade e layout ainda em regulamentacao pelo CG-IBS "
         "e pela Receita Federal. Monitorar publicacoes oficiais."),
        ("<b>Atualizacao de ERP e sistemas de faturamento:</b> os sistemas precisarao "
         "calcular CBS/IBS por operacao, controlar creditos de entrada, gerar os campos nas NFs "
         "e conciliar o Split Payment bancario com o saldo a recolher."),
        ("<b>Revisao de contratos de longo prazo:</b> contratos vigentes podem ter clausulas "
         "tributarias incompativeis com o novo sistema — preco fixo, reajuste por indice "
         "tributario ou isencoes de {0} que deixarao de existir. Revisao preventiva e essencial.".format(tipo_trib)),
        ("<b>Revisao de precificacao:</b> com a nao cumulatividade plena, o preco de venda "
         "pode ser ajustado para refletir o credito de CBS/IBS sobre insumos. "
         "Empresas antes no cumulativo (LP) tendem a ter maior margem de ajuste positivo."),
    ]
    if inp.perfil_clientes in ("pj", "misto"):
        obrig.append(
            f"<b>Comunicacao com clientes PJ (B2B):</b> compradores no Lucro Real ou Presumido "
            f"utilizarao o CBS/IBS discriminado na NF como credito tributario. "
            f"A correta emissao e requisito legal e um diferencial competitivo importante.")
    for txt in obrig:
        elements.append(Paragraph(f"• {txt}", ST["body_j"]))
        elements.append(Spacer(1, 2))

    # ── 7. IMPACTO POR REGIME ────────────────────────────────────────────────
    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"Impacto Especifico para o {regime_nome}", ST["h3"]),
        Spacer(1, 3),
    ]))
    if inp.regime_atual == "lucro_presumido":
        presuncao = so.get("presuncao_irpj", 0.32)
        regime_txt = (
            f"No <b>Lucro Presumido</b>, as mudancas mais significativas sao: "
            f"(1) extincao do PIS/COFINS cumulativos (3,65% sem credito) e entrada da CBS "
            f"nao cumulativa ({cbs_ef_pct}% ef., com credito sobre entradas); "
            f"(2) substituicao progressiva do {tipo_trib} pelo IBS de 2029 a 2032. "
            f"A presuncao de lucro de {int(presuncao*100)}% para IRPJ/CSLL nao e alterada "
            f"pela reforma. O principal impacto financeiro e o Split Payment, que retira o "
            f"CBS/IBS antes de o valor chegar a conta. Revisar o capital de giro antes de 2027."
            + (f" A analise indica que o <b>{melhor_nome_r}</b> pode ser o regime mais vantajoso "
               f"apos a reforma: consultar o contador para validacao."
               if melhor_key and inp.regime_atual != melhor_key else "")
        )
    elif inp.regime_atual == "lucro_real":
        regime_txt = (
            f"No <b>Lucro Real</b>, a logica ja familiar do PIS/COFINS nao cumulativos "
            f"(1,65%+7,6%) se transfere para CBS/IBS. A adaptacao operacional e menor. "
            f"O impacto principal e o Split Payment, que elimina o prazo de recolhimento "
            f"e exige revisao do capital de giro. O IRPJ e a CSLL continuam calculados "
            f"sobre o lucro apurado sem alteracoes estruturais pela reforma."
            + (f" A analise indica que o <b>{melhor_nome_r}</b> pode ser mais vantajoso "
               f"apos a reforma: consultar o contador."
               if melhor_key and inp.regime_atual != melhor_key else "")
        )
    elif inp.regime_atual == "simples_nacional":
        regime_txt = (
            f"Para o <b>Simples Nacional</b>, as regras de CBS/IBS ainda serao definidas "
            f"pelo CG-IBS. A expectativa e incorporacao ao DAS de forma simplificada. "
            f"Dois pontos criticos: (1) o <b>Simples Hibrido</b> permite destacar CBS/IBS "
            f"na NF para clientes B2B, ao custo de aliquota maior; "
            f"(2) a reforma pode tornar o Simples menos vantajoso para empresas com "
            f"faturamento proximo ao limite de R$ 4,8M. Avaliar migracao antecipada. "
            f"Em 2026, optantes estao dispensados do CBS/IBS-teste."
        )
    elif inp.regime_atual == "mei":
        regime_txt = (
            f"Para o <b>MEI</b>, as regras serao regulamentadas pelo CG-IBS de forma simplificada. "
            f"Atentar ao limite de R$ 81.000/ano: se superado, a migracao para Simples Nacional "
            f"e obrigatoria e deve ser planejada antes de 2029."
        )
    else:
        regime_txt = (
            f"A Reforma substitui PIS e COFINS pela CBS (2027) e {tipo_trib} pelo IBS "
            f"(transicao 2029-2033). O recolhimento passa a ser via Split Payment. "
            f"IRPJ e CSLL permanecem sem alteracoes estruturais."
        )
    elements.append(Paragraph(regime_txt, ST["body_j"]))

    # ── 8. PONTOS DE ATENCAO ─────────────────────────────────────────────────
    elements.append(KeepTogether([
        Spacer(1, 8),
        Paragraph("Principais Pontos de Atencao", ST["h3"]),
        Spacer(1, 3),
    ]))
    atencao = [
        f"<b>2026 — Periodo de testes (agir agora):</b> adequar os sistemas para destacar "
        f"CBS (0,9%) e IBS (0,1%) nas notas fiscais. Sem carga adicional real, mas a "
        f"adequacao tecnica e obrigatoria. Oportunidade para capacitar a equipe e ajustar o ERP.",

        f"<b>2027 — CBS plena (marco critico):</b> PIS e COFINS extintos em 31/12/2026. "
        f"CBS a {cbs_ef_pct}% ef. retida via Split Payment. "
        f"Revisar contratos, precificacao e capital de giro antes dessa data.",

        f"<b>2029-2032 — Periodo hibrido:</b> CBS e {tipo_trib} coexistem durante a transicao. "
        f"O {tipo_trib} e reduzido 10% ao ano enquanto o IBS avanca. "
        f"Dois sistemas rodando simultaneamente exigem controles paralelos e apuracao cuidadosa.",

        f"<b>2033 — Sistema pleno (data final):</b> {tipo_trib} extinto. "
        f"CBS ({cbs_ef_pct}%) + IBS ({ibs_ef_pct}%) = {total_ef_pct}% ef. "
        f"Split Payment definitivo, creditamento pleno e operacional.",
    ]
    if red_pct > 0:
        atencao.insert(1,
            f"<b>CNAE — condicao para o beneficio fiscal:</b> a reducao de {red_pct}% nas "
            f"aliquotas de CBS/IBS e condicionada ao CNAE correto cadastrado na Receita Federal "
            f"e na Prefeitura. Auditar e atualizar o CNAE e indispensavel para garantir o "
            f"beneficio desde o inicio da CBS em 2027 (LC 214/2025, Arts. 130-133).")
    if inp.perfil_clientes in ("pj", "misto"):
        atencao.append(
            "<b>Clientes B2B — credito de CBS/IBS:</b> compradores no Lucro Real ou Presumido "
            "utilizarao o CBS/IBS discriminado na NF como credito tributario. "
            "A correta emissao e requisito legal e diferencial competitivo. "
            "NFs incorretas podem gerar conflito comercial ou perda de clientes.")
    if melhor_key and inp.regime_atual and melhor_key != inp.regime_atual:
        atencao.append(
            f"<b>Avaliar mudanca de regime:</b> a analise indica que o "
            f"<b>{melhor_nome_r}</b> pode ser mais vantajoso apos a reforma. "
            f"A comunicacao a Receita Federal deve ser feita no prazo correto: "
            f"consultar o contador antes de qualquer decisao.")
    for txt in atencao:
        elements.append(Paragraph(f"• {txt}", ST["body_j"]))
        elements.append(Spacer(1, 2))

    # Caixa de destaque final
    elements.append(Spacer(1, 6))
    if total_ef_pct < 15:
        msg = (
            f"O setor <b>{setor_nome}</b> conta com uma das menores aliquotas efetivas do "
            f"novo sistema: CBS {cbs_ef_pct}% + IBS {ibs_ef_pct}% = <b>{total_ef_pct}%</b>, "
            f"gracos a reducao de {red_pct}% garantida pela LC 214/2025. "
            f"O principal desafio e operacional (Split Payment, novos sistemas, CNAE correto), "
            f"nao necessariamente tributario."
        )
    else:
        msg = (
            f"Com CBS {cbs_ef_pct}% + IBS {ibs_ef_pct}% = <b>{total_ef_pct}%</b> ef. em 2033, "
            f"o planejamento tributario antecipado e fundamental. "
            f"O aproveitamento maximo dos creditos de entrada e a adequacao tempestiva do "
            f"fluxo de caixa ao Split Payment sao os dois maiores alavancadores de resultado."
        )
    elements.append(_insight_box(ST, msg, BRAND, colors.HexColor("#EFF6FF")))

    return elements


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

    # Pre-load setor/cron/icms se setor_id informado
    setor_obj: dict | None = None
    cron_obj: dict | None = None
    icms_uf: float = 0.18
    if inp.setor_id:
        try:
            setor_obj = get_setor(inp.setor_id)
            cron_obj = get_cronograma(comp.ano)
            icms_uf = get_icms_uf(comp.uf)
        except Exception:
            setor_obj = None

    def on_page(canvas, doc):
        canvas.saveState()
        fh = 42          # altura do rodapé em pontos
        lw = 135         # alcance horizontal de cada aba diagonal

        # barra azul no topo
        canvas.setFillColor(NAVY)
        canvas.rect(0, H - 8, W, 8, fill=1, stroke=0)

        # linha separadora acima do rodapé
        canvas.setStrokeColor(INK_400)
        canvas.setLineWidth(0.35)
        canvas.line(0, fh, W, fh)

        # aba esquerda
        canvas.setFillColor(NAVY)
        p = canvas.beginPath()
        p.moveTo(0, 0)
        p.lineTo(0, fh)
        p.lineTo(lw - 24, fh)
        p.lineTo(lw, 0)
        p.close()
        canvas.setFillColor(NAVY)
        canvas.drawPath(p, fill=1, stroke=0)

        # aba direita
        p = canvas.beginPath()
        p.moveTo(W, 0)
        p.lineTo(W, fh)
        p.lineTo(W - lw + 24, fh)
        p.lineTo(W - lw, 0)
        p.close()
        canvas.setFillColor(NAVY)
        canvas.drawPath(p, fill=1, stroke=0)

        # numero da pagina (branco, dentro da aba direita)
        canvas.setFont("Helvetica-Bold", 8.5)
        canvas.setFillColor(WHITE)
        canvas.drawCentredString(W - lw / 2 - 4, fh / 2 - 4, str(doc.page))

        # endereco centralizado (Latin-1 seguro: \xba = º, \xe1 = á)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(INK_600)
        canvas.drawCentredString(
            W / 2, fh / 2 + 5,
            "Rua XV de novembro, 1155, 10\xba Andar | Centro | Curitiba | Paran\xe1 | www.conflex.com.br",
        )
        canvas.drawCentredString(W / 2, fh / 2 - 7, "Telefone: (41) 3277-1313")

        canvas.restoreState()

    doc = _EstudoDoc(
        buf, pagesize=A4,
        leftMargin=margin, rightMargin=margin,
        topMargin=margin + 4, bottomMargin=margin + 10,
    )
    story = []

    # ── CAPA ────────────────────────────────────────────────────────────────
    _logo_path = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'assets', 'conflex-logo.png'))
    _logo_cell: list = []
    if os.path.exists(_logo_path):
        _logo = Image(_logo_path, width=5.2*cm, height=5.2*cm/4.15)
        _logo.hAlign = "RIGHT"
        _logo_cell = [_logo]

    _capa_hdr = Table(
        [[
            [Paragraph("Estudo Tributário", ST["title_inv"]),
             Paragraph("Análise Comparativa de Regimes — Sistema Atual e Reforma Tributária (LC 214/2025)", ST["subtitle_inv"])],
            _logo_cell or [Paragraph("", ST["body"])],
        ]],
        colWidths=[W - 2 * margin - 5.6 * cm, 5.6 * cm],
    )
    _capa_hdr.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), NAVY),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",   (0, 0), (0, 0),   18),
        ("RIGHTPADDING",  (0, 0), (0, 0),   8),
        ("TOPPADDING",    (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
        ("LEFTPADDING",   (1, 0), (1, 0),   8),
        ("RIGHTPADDING",  (1, 0), (1, 0),   16),
        ("ALIGN",         (1, 0), (1, 0),   "RIGHT"),
    ]))
    story.append(_capa_hdr)
    story.append(Spacer(1, 8))

    info_rows = [[Paragraph("<b>Empresa</b>", ST["cell_bold"]), Paragraph(inp.razao_social, ST["cell_l"])]]
    if inp.cnpj:
        info_rows.append([Paragraph("<b>CNPJ</b>", ST["cell_bold"]), Paragraph(inp.cnpj, ST["cell_l"])])
    info_rows += [
        [Paragraph("<b>Setor</b>",             ST["cell_bold"]), Paragraph(comp.setor, ST["cell_l"])],
        [Paragraph("<b>Estado (UF)</b>",        ST["cell_bold"]), Paragraph(comp.uf, ST["cell_l"])],
        [Paragraph("<b>Ano de referência</b>",  ST["cell_bold"]), Paragraph(str(comp.ano), ST["cell_l"])],
        [Paragraph("<b>Faturamento anual</b>",  ST["cell_bold"]), Paragraph(brl(inp.faturamento_anual), ST["cell_l"])],
        [Paragraph("<b>Operação base</b>",      ST["cell_bold"]), Paragraph(brl(comp.valor_base), ST["cell_l"])],
        [Paragraph("<b>Crédito de entrada</b>", ST["cell_bold"]), Paragraph(pct(inp.credito_entrada * 100, 0), ST["cell_l"])],
        [Paragraph("<b>Data de emissão</b>",    ST["cell_bold"]), Paragraph(today, ST["cell_l"])],
    ]
    if inp.despesas_mensais:
        info_rows.append([Paragraph("<b>Despesas mensais (est.)</b>", ST["cell_bold"]),
                          Paragraph(brl(inp.despesas_mensais), ST["cell_l"])])
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
        obj_labels = ", ".join(_OBJETIVO_LABEL.get(o, o) for o in inp.objetivo_estudo)
        info_rows.append([Paragraph("<b>Objetivo do estudo</b>", ST["cell_bold"]),
                          Paragraph(obj_labels, ST["cell_l"])])

    info_t = Table(info_rows, colWidths=[5.5*cm, None])
    info_t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, INK_100),
    ]))
    story.append(info_t)
    story.append(Spacer(1, 6))

    # ── Faixa de métricas-chave ──────────────────────────────────────────────
    _melhor_capa = next((r for r in disponiveis if r.regime == melhor_key), None)
    _pior_capa   = max(disponiveis, key=lambda x: x.total_novo or 0) if disponiveis else None
    if _melhor_capa and _pior_capa and comp.valor_base > 0:
        _eco_capa = (
            ((_pior_capa.total_novo or 0) - (_melhor_capa.total_novo or 0))
            / comp.valor_base * inp.faturamento_anual
        )
        _col_w = (W - 2 * margin) / 3
        _mc_data = [[
            Paragraph(brl(inp.faturamento_anual), ST["metric"]),
            Paragraph(_melhor_capa.nome, ST["metric"]),
            Paragraph(brl(_eco_capa) if _eco_capa > 0 else "—", ST["metric"]),
        ], [
            Paragraph("Faturamento anual", ST["metric_lbl"]),
            Paragraph(f"Regime mais vantajoso ({comp.ano})", ST["metric_lbl"]),
            Paragraph(f"Economia est. vs {_pior_capa.nome}", ST["metric_lbl"]),
        ]]
        _mc = Table(_mc_data, colWidths=[_col_w, _col_w, _col_w])
        _mc.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), INK_50),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("BOX",           (0, 0), (-1, -1), 0.5, INK_400),
            ("LINEAFTER",     (0, 0), (1, -1),  0.3, INK_400),
            ("LINEABOVE",     (0, 0), (0, 0),   3, BRAND),
            ("LINEABOVE",     (1, 0), (1, 0),   3, EMERALD),
            ("LINEABOVE",     (2, 0), (2, 0),   3, EMERALD),
        ]))
        story.append(_mc)

    # ── SUMÁRIO ──────────────────────────────────────────────────────────────
    toc = TableOfContents()
    toc.levelStyles = [ST["toc0"], ST["toc1"]]
    toc.dotsMinLevel = 0
    story.append(PageBreak())
    story.append(Paragraph("Sumário", ST["toc_title"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BRAND, spaceAfter=8))
    story.append(toc)
    story.append(PageBreak())

    story.append(Spacer(1, 8))

    # Intro
    objs = inp.objetivo_estudo
    if "reforma" in objs and "mudanca" in objs:
        regime_atual_nome = _REGIME_LABEL.get(inp.regime_atual, "regime atual") if inp.regime_atual else "regime atual"
        intro = (
            f"Este estudo avalia, para <b>{inp.razao_social}</b>, tanto a viabilidade de mudanca de regime "
            f"(atualmente no <b>{regime_atual_nome}</b>) quanto o impacto da Reforma Tributária (LC 214/2025) "
            f"sobre a carga tributária a partir de {comp.ano}. A análise cobre os quatro regimes disponíveis "
            "no sistema atual e no novo sistema, com memorias de cálculo detalhadas por tributo e por regime."
        )
    elif "reforma" in objs:
        intro = (
            f"Este estudo analisa o impacto da Reforma Tributária (LC 214/2025) sobre a carga tributária de "
            f"<b>{inp.razao_social}</b>, comparando o sistema atual com o novo sistema a partir de {comp.ano}, "
            "com memorias de cálculo detalhadas por tributo e por regime."
        )
    elif "mudanca" in objs:
        regime_atual_nome = _REGIME_LABEL.get(inp.regime_atual, "regime atual") if inp.regime_atual else "regime atual"
        intro = (
            f"Este estudo avalia a viabilidade de mudanca de regime tributário para <b>{inp.razao_social}</b>, "
            f"atualmente no <b>{regime_atual_nome}</b>. A análise compara os quatro regimes disponíveis "
            f"(MEI, Simples Nacional, Lucro Presumido e Lucro Real) com memorias de cálculo detalhadas, "
            "para identificar o regime mais adequado no sistema atual e no novo sistema."
        )
    else:
        intro = (
            f"Este estudo compara os regimes de tributação disponíveis no Brasil para <b>{inp.razao_social}</b>, "
            f"com memorias de cálculo detalhadas por tributo e por regime, analisando o sistema atual "
            f"e o novo sistema (Reforma Tributária - LC 214/2025) a partir de {comp.ano}."
        )
    story.append(Paragraph(intro, ST["body_j"]))

    if comp.valores_projetados:
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            "<b>Atencao:</b> As alíquotas de referencia do IBS (~18,7%) e CBS (~9,3%) "
            "ainda nao foram confirmadas pelo Senado Federal. Os valores do novo sistema "
            "sao estimativas sujeitas a alteracao.",
            ST["small"]))

    # ── BASE LEGAL ───────────────────────────────────────────────────────────
    sec = 1
    if setor_obj is not None:
        story.extend(_base_legal_section(ST, sec, setor_obj, comp.setor, inp.regime_atual or "", comp.uf, icms_uf))
        sec += 1

    # ── PERFIL FINANCEIRO ────────────────────────────────────────────────────
    if inp.resultado_financeiro or inp.despesas_mensais is not None:
        story.append(Paragraph(f"{sec}. Perfil Financeiro da Empresa", ST["h1"]))
        if inp.resultado_financeiro:
            res_label = _RESULTADO_LABEL.get(inp.resultado_financeiro, "")
            if inp.resultado_financeiro == "lucrativa":
                res_txt = (
                    f"A empresa se encontra em situacao <b>{res_label}</b>. "
                    "No Lucro Real, havera IRPJ e CSLL sobre o lucro apurado. "
                    "O Simples Nacional e o Lucro Presumido calculam o imposto sobre o faturamento, "
                    "independentemente do resultado."
                )
            elif inp.resultado_financeiro == "prejuizo":
                res_txt = (
                    f"A empresa se encontra em situacao de <b>{res_label}</b>. "
                    "No Lucro Real, o prejuizo elimina o IRPJ e a CSLL do período. "
                    "O prejuizo acumulado pode ser compensado em ate 30% do lucro de anos futuros. "
                    "ISS (ou IBS), PIS e COFINS (ou CBS) continuam devidos sobre o faturamento."
                )
            else:
                res_txt = (
                    f"A empresa se encontra em <b>{res_label}</b>. "
                    "No Lucro Real, o IRPJ e a CSLL incidem apenas sobre o lucro positivo — "
                    "em situacao de equilibrio, tendem a ser reduzidos ou zerados."
                )
            story.append(Paragraph(res_txt, ST["body_j"]))
        if inp.despesas_mensais is not None:
            story.append(Paragraph(
                f"<b>Despesas medias mensais informadas (Lucro Real):</b> {brl(inp.despesas_mensais)} — "
                "utilizadas para estimar a base de cálculo do IRPJ/CSLL.",
                ST["body"]))
        sec += 1

    # ── 2. COMPARATIVO — SISTEMA ATUAL ───────────────────────────────────────
    hdr_a = [Paragraph("Regime", ST["cell_header_l"]),
              Paragraph("Carga Total", ST["cell_header"]),
              Paragraph("% s/ Operação", ST["cell_header"]),
              Paragraph("Situação", ST["cell_header"])]
    rows_a = [hdr_a]
    for r in comp.comparativo:
        is_best = r.regime == melhor_key and r.disponivel
        is_current = r.regime == inp.regime_atual
        nome_txt = r.nome + (" (atual)" if is_current else "")
        nome_p = Paragraph(f"<b>{nome_txt}</b>" if is_best or is_current else nome_txt,
                           ST["cell_bold"] if is_best or is_current else ST["cell_l"])
        if r.disponivel:
            rows_a.append([nome_p,
                           Paragraph(brl(r.total_atual or 0), ST["cell_green_r"] if is_best else ST["cell_r"]),
                           Paragraph(pct(r.percentual_atual or 0), ST["cell_r"]),
                           Paragraph("Disponível", ST["badge_ok"])])
        else:
            rows_a.append([nome_p, Paragraph("--", ST["cell_r"]),
                           Paragraph("--", ST["cell_r"]), Paragraph("Vedado", ST["badge_no"])])
    t_a = Table(rows_a, colWidths=[7.5*cm, 4.0*cm, 4.0*cm, 3.0*cm], repeatRows=1)
    t_a.setStyle(_table_style())
    story.append(Paragraph(f"{sec}. Sistema Atual — Carga por Regime", ST["h1"]))
    story.append(Paragraph(
        f"Carga tributária por operação de {brl(comp.valor_base)}, incluindo IRPJ/CSLL atribuivel.",
        ST["body"]))
    story.append(t_a)
    if disponiveis:
        _melhor_atual = min(disponiveis, key=lambda x: x.total_atual or float("inf"))
        _narra_a = (
            f"Entre os regimes disponíveis, o <b>{_melhor_atual.nome}</b> apresenta a menor carga "
            f"tributária no sistema atual: <b>{brl(_melhor_atual.total_atual or 0)}</b> "
            f"({pct(_melhor_atual.percentual_atual or 0)} sobre a operacao de {brl(comp.valor_base)}). "
        )
        _atual_r = next((r for r in disponiveis if r.regime == inp.regime_atual), None)
        if _atual_r and _atual_r.regime != _melhor_atual.regime:
            _dif_a = (_atual_r.total_atual or 0) - (_melhor_atual.total_atual or 0)
            _narra_a += (
                f"O regime atual da empresa ({_atual_r.nome}) apresenta carga de "
                f"{brl(_atual_r.total_atual or 0)} ({pct(_atual_r.percentual_atual or 0)}), "
                f"com diferenca de {brl(_dif_a)} em relacao ao mais vantajoso."
            )
        story.append(Spacer(1, 4))
        story.append(Paragraph(_narra_a, ST["body_j"]))
    sec += 1

    # ── 3. COMPARATIVO — NOVO SISTEMA ────────────────────────────────────────
    sorted_disp = sorted(disponiveis, key=lambda x: x.total_novo or 0)
    ranking = {r.regime: i + 1 for i, r in enumerate(sorted_disp)}

    hdr_n = [Paragraph("Regime", ST["cell_header_l"]),
              Paragraph("Carga Nova", ST["cell_header"]),
              Paragraph("% s/ Operação", ST["cell_header"]),
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
            rows_n.append([nome_p,
                           Paragraph(brl(r.total_novo or 0), ST["cell_green_r"] if is_best else ST["cell_r"]),
                           Paragraph(pct(r.percentual_novo or 0), ST["cell_r"]),
                           Paragraph(rk_txt, ST["badge_ok"] if is_best else ST["cell_l"])])
        else:
            rows_n.append([nome_p, Paragraph("--", ST["cell_r"]),
                           Paragraph("--", ST["cell_r"]), Paragraph("Vedado", ST["badge_no"])])
    t_n = Table(rows_n, colWidths=[7.5*cm, 4.0*cm, 4.0*cm, 3.0*cm], repeatRows=1)
    t_n.setStyle(_table_style(EMERALD))
    story.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"{sec}. Novo Sistema ({comp.ano}) — Carga por Regime", ST["h1"]),
    ]))
    story.append(t_n)
    if disponiveis and setor_obj is not None:
        _red_setor = setor_obj.get("reducao_aliquota", 1.0)
        _red_pct_n = int(round((1 - _red_setor) * 100))
        _melhor_n = next((r for r in disponiveis if r.regime == melhor_key), None)
        _narra_n = ""
        if _red_pct_n > 0:
            try:
                _c33 = get_cronograma(2033)
                _cbs33 = round(_c33.get("cbs_percentual", 0.088) * _red_setor * 100, 2)
                _ibs33 = round(_c33.get("ibs_percentual", 0.192) * _red_setor * 100, 2)
                _narra_n += (
                    f"O setor <b>{comp.setor}</b> beneficia-se de reducao setorial de <b>{_red_pct_n}%</b>, "
                    f"com alíquotas efetivas de CBS {_cbs33}% e IBS {_ibs33}% (em 2033). "
                )
            except Exception:
                pass
        if _melhor_n:
            _narra_n += (
                f"No novo sistema, o <b>{_melhor_n.nome}</b> é o regime mais vantajoso em {comp.ano}, "
                f"com carga de {brl(_melhor_n.total_novo or 0)} ({pct(_melhor_n.percentual_novo or 0)}) "
                f"por operacao de {brl(comp.valor_base)}."
            )
        if _narra_n:
            story.append(Spacer(1, 4))
            story.append(Paragraph(_narra_n, ST["body_j"]))
    sec += 1

    # ── 4. VARIACAO ───────────────────────────────────────────────────────────
    hdr_v = [Paragraph("Regime", ST["cell_header_l"]),
              Paragraph("Atual", ST["cell_header"]),
              Paragraph("Novo", ST["cell_header"]),
              Paragraph("Diferenca", ST["cell_header"]),
              Paragraph("Var. %", ST["cell_header"]),
              Paragraph("Econ./Ano est.", ST["cell_header"])]
    rows_v = [hdr_v]
    for r in comp.comparativo:
        is_best = r.regime == melhor_key and r.disponivel
        is_current = r.regime == inp.regime_atual
        nome_txt = r.nome + (" (atual)" if is_current else "")
        nome_p = Paragraph(f"<b>{nome_txt}</b>" if is_best or is_current else nome_txt,
                           ST["cell_bold"] if is_best or is_current else ST["cell_l"])
        if r.disponivel:
            diff = r.diferenca or 0
            prefix = "+" if diff > 0 else ""
            diff_s = ST["cell_red_r"] if diff > 0 else ST["cell_green_r"]
            eco = r.economia_anual_estimada or 0
            eco_s = ST["cell_green_r"] if eco < 0 else ST["cell_red_r"]
            rows_v.append([nome_p,
                           Paragraph(brl(r.total_atual or 0), ST["cell_r"]),
                           Paragraph(brl(r.total_novo or 0), ST["cell_green_r"] if is_best else ST["cell_r"]),
                           Paragraph(f"{prefix}{brl(diff)}", diff_s),
                           Paragraph(f"{prefix}{pct(r.diferenca_percentual or 0, 1)}", diff_s),
                           Paragraph(brl(eco), eco_s)])
        else:
            rows_v.append([nome_p] + [Paragraph("--", ST["cell_r"])] * 5)
    t_v = Table(rows_v, colWidths=[5.0*cm, 3.0*cm, 3.0*cm, 3.0*cm, 2.5*cm, 3.5*cm], repeatRows=1)
    t_v.setStyle(_table_style(INK_600))
    story.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"{sec}. Variação: Sistema Atual x Novo Sistema", ST["h1"]),
    ]))
    story.append(t_v)
    if disponiveis:
        _sorted_var = sorted(disponiveis, key=lambda x: x.diferenca or 0)
        _mv = _sorted_var[0]
        if (_mv.diferenca or 0) < 0:
            _narra_v = (
                f"A reforma tributária é favorável para o <b>{_mv.nome}</b>, "
                f"resultando em reducao de carga de {brl(abs(_mv.diferenca or 0))} por operacao "
                f"({pct(abs(_mv.diferenca_percentual or 0), 1)})."
            )
        else:
            _narra_v = (
                f"A reforma tributária representa acréscimo de carga tributária para este setor. "
                f"O <b>{_mv.nome}</b> apresenta o menor impacto: acréscimo de "
                f"{brl(_mv.diferenca or 0)} por operacao ({pct(_mv.diferenca_percentual or 0, 1)})."
            )
        story.append(Spacer(1, 6))
        _var_positivo = (_mv.diferenca or 0) < 0
        story.append(_insight_box(
            ST, _narra_v,
            EMERALD if _var_positivo else AMBER,
            colors.HexColor("#ECFDF5") if _var_positivo else colors.HexColor("#FFFBEB"),
        ))
    sec += 1

    # ── 5. DESTAQUE DO MELHOR REGIME ─────────────────────────────────────────
    melhor_obj = next((r for r in disponiveis if r.regime == melhor_key), None) if melhor_key else None
    if melhor_obj:
        story.append(Spacer(1, 8))
        story.append(KeepTogether([
            Paragraph(f"{sec}. Regime Mais Vantajoso para o Novo Sistema", ST["h1"]),
            ColorBar(EMERALD, height=3), Spacer(1, 5),
        ]))
        pior = max(disponiveis, key=lambda x: x.total_novo or 0)
        eco_op = (pior.total_novo or 0) - (melhor_obj.total_novo or 0)
        eco_anual = (eco_op / comp.valor_base * inp.faturamento_anual if comp.valor_base > 0 else 0)
        dest_rows = [
            [Paragraph("Regime recomendado", ST["cell_bold"]),
             Paragraph(melhor_obj.nome, ST["cell_green_r"])],
            [Paragraph("Carga tributária (novo sistema)", ST["cell_bold"]),
             Paragraph(brl(melhor_obj.total_novo or 0), ST["cell_green_r"])],
            [Paragraph("% sobre operação", ST["cell_bold"]),
             Paragraph(pct(melhor_obj.percentual_novo or 0), ST["cell_r"])],
        ]
        if eco_anual > 0:
            dest_rows.append([Paragraph(f"Economia anual estimada vs {pior.nome}", ST["cell_bold"]),
                              Paragraph(brl(eco_anual), ST["cell_green_r"])])
        if inp.regime_atual and inp.regime_atual != melhor_key:
            atual_obj = next((r for r in disponiveis if r.regime == inp.regime_atual), None)
            if atual_obj:
                dif = (atual_obj.total_novo or 0) - (melhor_obj.total_novo or 0)
                eco_vs = dif / comp.valor_base * inp.faturamento_anual if comp.valor_base > 0 else 0
                if eco_vs > 0:
                    dest_rows.append([Paragraph(f"Economia vs regime atual ({atual_obj.nome})", ST["cell_bold"]),
                                      Paragraph(brl(eco_vs), ST["cell_green_r"])])
        if (melhor_obj.irpj_csll_estimado or 0) > 0:
            dest_rows.append([Paragraph("IRPJ/CSLL incluído", ST["cell_bold"]),
                              Paragraph(brl(melhor_obj.irpj_csll_estimado or 0), ST["cell_r"])])
        dest_t = Table(dest_rows, colWidths=[9.5*cm, None])
        dest_t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), EMRLD_100),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, EMRLD_50]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("LINEBELOW", (0, 0), (-1, -2), 0.3, EMRLD_200),
            ("BOX", (0, 0), (-1, -1), 0.8, EMERALD),
            ("LINEBEFORE", (0, 0), (0, -1), 3, EMERALD),
        ]))
        story.append(dest_t)
        if eco_anual > 0:
            _atual_obj_dest = next((r for r in disponiveis if r.regime == inp.regime_atual), None)
            if _atual_obj_dest and inp.regime_atual != melhor_key:
                _dif_dest = (_atual_obj_dest.total_novo or 0) - (melhor_obj.total_novo or 0)
                _eco_dest = _dif_dest / comp.valor_base * inp.faturamento_anual if comp.valor_base > 0 else 0
                _txt_dest = (
                    f"Ao adotar o <b>{melhor_obj.nome}</b> no novo sistema, a economia estimada é de "
                    f"<b>{brl(_eco_dest)}</b> anuais em relação ao {_atual_obj_dest.nome} (regime atual), "
                    f"com base no faturamento de {brl(inp.faturamento_anual)}."
                )
            else:
                _txt_dest = (
                    f"O <b>{melhor_obj.nome}</b> é o regime mais vantajoso no novo sistema em {comp.ano}, "
                    f"com economia de <b>{brl(eco_anual)}</b> anuais em relação ao regime de maior carga ({pior.nome})."
                )
            story.append(Spacer(1, 6))
            story.append(_insight_box(ST, _txt_dest))
        sec += 1

    # ── DRE SIMULADA ────────────────────────────────────────────────────────
    _dre_regime_key = melhor_key or inp.regime_atual
    if _dre_regime_key and setor_obj is not None and cron_obj is not None:
        _dre_r = next((r for r in disponiveis if r.regime == _dre_regime_key), None)
        if _dre_r:
            dre_els = _dre_section(
                ST, sec,
                _dre_regime_key, _dre_r.nome,
                setor_obj, comp.uf, comp.ano,
                comp.valor_base, inp.faturamento_anual,
                inp.despesas_mensais, _dre_r.irpj_csll_estimado or 0.0,
                inp.credito_entrada, inp.folha_pagamento_mensal,
                cron_obj, icms_uf,
            )
            if dre_els:
                story.extend(dre_els)
                sec += 1

    # ── ANALISE POR REGIME ───────────────────────────────────────────────────
    if setor_obj is not None and len(disponiveis) > 1:
        _ar_els = _analise_regimes_section(ST, sec, comp, setor_obj, inp)
        if _ar_els:
            story.extend(_ar_els)
            sec += 1

    # ── CONCLUSAO E RECOMENDACAO ─────────────────────────────────────────────
    story.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"{sec}. Conclusão e Recomendação", ST["h1"]),
        Spacer(1, 3),
    ]))
    melhor_obj2 = next((r for r in disponiveis if r.regime == melhor_key), None) if melhor_key else None

    if "mudanca" in objs and inp.regime_atual and melhor_key and inp.regime_atual != melhor_key:
        regime_atual_nome = _REGIME_LABEL.get(inp.regime_atual, inp.regime_atual)
        melhor_nome = melhor_obj2.nome if melhor_obj2 else melhor_key
        conclusao = (
            f"Com base na análise realizada, a empresa <b>{inp.razao_social}</b> pode se beneficiar "
            f"de uma mudanca do <b>{regime_atual_nome}</b> para o <b>{melhor_nome}</b>, "
            f"que representa a menor carga tributária no novo sistema para o ano {comp.ano}. "
        )
        if melhor_obj2:
            conclusao += (
                f"A carga estimada no {melhor_nome} seria de <b>{brl(melhor_obj2.total_novo or 0)}</b> "
                f"por operação de {brl(comp.valor_base)} ({pct(melhor_obj2.percentual_novo or 0)} sobre o valor). "
            )
        conclusao += (
            "A saida do regime atual por escolha propria geralmente vale a partir de 1 de janeiro "
            "do ano seguinte. Recomendamos acompanhar os resultados ao longo do segundo semestre "
            "para confirmar se a mudanca e vantajosa antes da comunicacao a Receita Federal."
        )
        if "reforma" in objs:
            conclusao += (
                " Quanto a Reforma Tributária, o CBS substituira PIS/COFINS a partir de 2027 e o IBS "
                "substituira ISS/ICMS progressivamente ate 2032. Os valores projetados sao estimativas "
                "recomendamos revisar esta análise anualmente conforme as alíquotas definitivas forem publicadas."
            )
    elif "reforma" in objs:
        if melhor_obj2:
            conclusao = (
                f"Diante da Reforma Tributária (LC 214/2025), o regime mais vantajoso para "
                f"<b>{inp.razao_social}</b> em {comp.ano} e o <b>{melhor_obj2.nome}</b>, "
                f"com carga de <b>{brl(melhor_obj2.total_novo or 0)}</b> por operação de {brl(comp.valor_base)}. "
                "O CBS substituira PIS/COFINS a partir de 2027 e o IBS substituira ISS/ICMS progressivamente "
                "ate 2032. Os valores apresentados sao estimativas, recomendamos revisar anualmente."
            )
        else:
            conclusao = "A Reforma Tributária introduz mudancas relevantes que devem ser acompanhadas anualmente."
    else:
        if melhor_obj2:
            conclusao = (
                f"Com base nos dados analisados, o regime mais vantajoso para "
                f"<b>{inp.razao_social}</b> no novo sistema tributário ({comp.ano}) "
                f"e o <b>{melhor_obj2.nome}</b>, com carga de "
                f"<b>{brl(melhor_obj2.total_novo or 0)}</b> por operação de "
                f"{brl(comp.valor_base)} ({pct(melhor_obj2.percentual_novo or 0)} sobre o valor)."
            )
        else:
            conclusao = "Nenhum regime disponível foi identificado para os parâmetros informados."

    story.append(Paragraph(conclusao, ST["body_j"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Recomendamos revisar esta análise anualmente, ao fechar o balanco, "
        "para confirmar se o regime continua sendo a melhor opcao a luz do "
        "faturamento, lucro e estrutura de despesas do período.",
        ST["body_j"]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Proximos passos recomendados:", ST["h3"]))
    story.append(Spacer(1, 3))
    _acoes_conclusao = []
    if "mudanca" in objs and inp.regime_atual and melhor_key and inp.regime_atual != melhor_key:
        _melhor_nome_c = melhor_obj2.nome if melhor_obj2 else melhor_key
        _acoes_conclusao.append(
            f"<b>Avaliar mudanca para {_melhor_nome_c}:</b> a opcao pelo novo regime deve ser "
            "comunicada à Receita Federal em janeiro do ano seguinte. Confirme os resultados "
            "do segundo semestre com seu contador antes de formalizar a mudanca."
        )
    _acoes_conclusao += [
        "<b>Monitorar a publicacao das alíquotas definitivas de CBS e IBS</b> pelo Senado Federal (previsao 2025/2026). Os valores deste estudo sao estimativas com base na LC 214/2025.",
        "<b>Organizar o registro de créditos de entrada</b> (insumos, servicos e bens usados na atividade) para aproveitamento de IBS e CBS a partir de 2027.",
        "<b>Revisar contratos, precos e notas fiscais</b> para adaptar o destaque de CBS e IBS conforme exigido pela nova legislacao.",
        "<b>Revisar este estudo anualmente</b>, ao fechar o balanco do exercício, para confirmar se o regime escolhido permanece vantajoso.",
    ]
    if inp.perfil_clientes == "pj":
        _acoes_conclusao.append(
            "<b>Avaliar o Simples Híbrido (se aplicável):</b> clientes PJ aproveitam o CBS e IBS destacados "
            "na nota como crédito tributário. Consulte seu contador sobre a viabilidade."
        )
    for _acao in _acoes_conclusao:
        story.append(Paragraph(f"• {_acao}", ST["body_j"]))
        story.append(Spacer(1, 2))

    sec += 1

    # ── 6. VARIACAO ANO A ANO (2026-2033) ────────────────────────────────────
    story.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"{sec}. Evolução da Carga Tributária — Ano a Ano (2026-2033)", ST["h1"]),
        Paragraph(
            f"Projeção da carga tributária por operação de {brl(comp.valor_base)}, para cada regime "
            "disponível, ao longo da transição da Reforma Tributária. A redução do PIS/COFINS e "
            "ICMS/ISS e compensada pelo crescimento progressivo do CBS e IBS conforme o cronograma "
            "da LC 214/2025. Os valores incluem IRPJ/CSLL estimado atribuivel a operação.",
            ST["body_j"]),
        Spacer(1, 6),
    ]))

    ANOS = list(range(2026, 2034))

    if setor_obj is not None:
        irpj_by_regime = {r.regime: (r.irpj_csll_estimado or 0.0) for r in comp.comparativo if r.disponivel}

        year_data: dict = {}
        for r in disponiveis:
            year_data[r.regime] = {}
            fat_a = inp.faturamento_anual if r.regime in ("mei", "simples_nacional") else None
            for yr in ANOS:
                try:
                    cron_yr = get_cronograma(yr)
                    res = calcular_sistema_novo(
                        comp.valor_base, r.regime, setor_obj, comp.uf, yr,
                        inp.credito_entrada, fat_a, inp.folha_pagamento_mensal,
                        _cron=cron_yr, _icms_uf=icms_uf,
                    )
                    year_data[r.regime][yr] = res.total + irpj_by_regime.get(r.regime, 0.0)
                except Exception:
                    year_data[r.regime][yr] = None

        def brl_k(v: float | None) -> str:
            if v is None:
                return "--"
            abs_v = abs(v)
            s = f"{abs_v:,.0f}".replace(",", ".")
            return f"-{s}" if v < 0 else s

        ref_col = ANOS.index(comp.ano) + 1  # +1 pois col 0 = regime

        # Tabela de valores absolutos (BRL, sem centavos)
        hdr_brl = [Paragraph("Regime", ST["cell_header_l"])]
        for yr in ANOS:
            lbl = f"<b>{yr}</b>" if yr == comp.ano else str(yr)
            hdr_brl.append(Paragraph(lbl, ST["cell_header"]))
        rows_brl = [hdr_brl]

        for r in disponiveis:
            is_best = r.regime == melhor_key
            nome_p = Paragraph(f"<b>{r.nome}</b>" if is_best else r.nome,
                               ST["cell_bold"] if is_best else ST["cell_l"])
            row = [nome_p]
            for yr in ANOS:
                v = year_data[r.regime].get(yr)
                is_ref = yr == comp.ano
                style = ST["cell_bold_r"] if is_ref else (ST["cell_green_r"] if is_best else ST["cell_r"])
                row.append(Paragraph(brl_k(v), style))
            rows_brl.append(row)

        # Linha de variação media 2026 → cada ano
        var_row = [Paragraph("Var. média vs 2026", ST["cell_bold"])]
        for yr in ANOS:
            vals = []
            for r in disponiveis:
                v26 = year_data[r.regime].get(2026)
                v = year_data[r.regime].get(yr)
                if v is not None and v26 and v26 > 0:
                    vals.append((v - v26) / v26 * 100)
            if vals:
                avg = sum(vals) / len(vals)
                prefix = "+" if avg > 0 else ""
                style = ST["cell_red_r"] if avg > 0 else ST["cell_green_r"]
                var_row.append(Paragraph(f"{prefix}{avg:.1f}%", style))
            else:
                var_row.append(Paragraph("--", ST["cell_r"]))
        rows_brl.append(var_row)

        col_w = [3.8*cm] + [1.65*cm] * 8
        t_brl = Table(rows_brl, colWidths=col_w, repeatRows=1)
        tbl_style_ano = TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), BRAND),
            ("ROWBACKGROUNDS",(0, 1), (-1, -2), [WHITE, INK_50]),
            ("BACKGROUND",    (0, -1), (-1, -1), INK_100),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
            ("FONTSIZE",      (0, 0), (-1, -1), 8.5),
            ("LINEBELOW",     (0, 0), (-1, -2), 0.25, INK_100),
            ("LINEABOVE",     (0, -1), (-1, -1), 0.5, INK_400),
            ("BACKGROUND",    (ref_col, 1), (ref_col, -2), EMRLD_50),
        ])
        t_brl.setStyle(tbl_style_ano)
        story.append(KeepTogether([
            Paragraph("Valor total dos tributos por operação (R$, sem centavos)", ST["label"]),
            Spacer(1, 3),
        ]))
        story.append(t_brl)
        story.append(Spacer(1, 3))
        story.append(Paragraph(
            f"Coluna destacada em verde = ano de referencia ({comp.ano}). Valores sem R$ para melhor leitura. Inclui IRPJ/CSLL estimado.",
            ST["small"]))

        story.append(Spacer(1, 6))

        # Tabela de percentual sobre valor da operação
        hdr_pct = [Paragraph("Regime", ST["cell_header_l"])]
        for yr in ANOS:
            lbl = f"<b>{yr}</b>" if yr == comp.ano else str(yr)
            hdr_pct.append(Paragraph(lbl, ST["cell_header"]))
        rows_pct = [hdr_pct]

        for r in disponiveis:
            is_best = r.regime == melhor_key
            nome_p = Paragraph(f"<b>{r.nome}</b>" if is_best else r.nome,
                               ST["cell_bold"] if is_best else ST["cell_l"])
            pct_row = [nome_p]
            for yr in ANOS:
                v = year_data[r.regime].get(yr)
                if v is not None and comp.valor_base > 0:
                    p = v / comp.valor_base * 100
                    is_ref = yr == comp.ano
                    style = ST["cell_bold_r"] if is_ref else (ST["cell_green_r"] if is_best else ST["cell_r"])
                    pct_row.append(Paragraph(f"{p:.1f}%", style))
                else:
                    pct_row.append(Paragraph("--", ST["cell_r"]))
            rows_pct.append(pct_row)

        t_pct = Table(rows_pct, colWidths=col_w, repeatRows=1)
        tbl_style_pct = TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), INK_600),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, INK_50]),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
            ("FONTSIZE",      (0, 0), (-1, -1), 8.5),
            ("LINEBELOW",     (0, 0), (-1, -2), 0.25, INK_100),
            ("BACKGROUND",    (ref_col, 1), (ref_col, -1), EMRLD_50),
        ])
        t_pct.setStyle(tbl_style_pct)
        story.append(KeepTogether([
            Paragraph("Carga tributária como % do valor da operação", ST["label"]),
            Spacer(1, 3),
        ]))
        story.append(t_pct)
        story.append(Spacer(1, 3))
        story.append(Paragraph(
            "Alíquotas de CBS e IBS sujeitas a confirmação pelo Senado Federal. Valores estimados com base na LC 214/2025.",
            ST["small"]))
    else:
        story.append(Paragraph(
            "Projeção ano a ano indisponível — setor não informado. "
            "Preencha todos os campos do comparador e gere novamente.",
            ST["body"]))
    sec += 1

    # ── 7. MEMORIA DE CALCULO ────────────────────────────────────────────────
    story.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"{sec}. Memória de Cálculo — Detalhamento por Tributo e por Regime", ST["h1"]),
        Paragraph(
            f"Detalhamento completo de cada tributo nas duas fases (sistema atual e novo sistema em {comp.ano}), "
            f"para uma operação de {brl(comp.valor_base)} no setor {comp.setor}, UF {comp.uf}. "
            "Fórmulas com base legal citada. Valores de IRPJ/CSLL estimados proporcionalmente por operação.",
            ST["body_j"]),
        Spacer(1, 6),
    ]))

    if setor_obj is not None and cron_obj is not None:
        for r in comp.comparativo:
            if not r.disponivel:
                continue
            irpj_csll = r.irpj_csll_estimado or 0.0
            is_current = r.regime == inp.regime_atual
            mem_elements = _memoria_regime_tables(
                ST, r.regime, r.nome, setor_obj, comp.uf, comp.ano,
                comp.valor_base, inp.faturamento_anual,
                inp.credito_entrada, inp.folha_pagamento_mensal,
                inp.despesas_mensais, irpj_csll, cron_obj, icms_uf, is_current,
            )
            story.extend(mem_elements)

        # Notas metodológicas
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", thickness=0.3, color=INK_100, spaceAfter=6))
        story.append(Paragraph("<b>Notas metodológicas:</b>", ST["label"]))
        notas = [
            "IBS e CBS sao calculados por fora: somados ao preço, sobre base que exclui outros tributos (ICMS, ISS, PIS/COFINS). No sistema atual, esses tributos sao calculados por dentro.",
            "Em 2026, CBS (0,9%) e IBS (0,1%) sao simbolicos — compensados com PIS/COFINS, nao aumentam a carga real.",
            "Crédito de entrada: compras e insumos usados na atividade geram crédito de IBS/CBS que abate o imposto a pagar.",
            "IRPJ e CSLL nao sao alterados pela reforma tributária — incidem sobre o lucro como hoje.",
            f"Alíquotas de referencia utilizadas: CBS ~{cron_obj.get('cbs_percentual', 0)*100:.1f}% e IBS ~{cron_obj.get('ibs_percentual', 0)*100:.1f}% (sujeitas a Resolucao do Senado Federal).",
            "Para Simples Nacional e MEI, a partir de 2027, o simulador usa projeção do regime híbrido — regulamentação definitiva pendente do Comitê Gestor do IBS (CG-IBS).",
        ]
        for nota in notas:
            story.append(Paragraph(f"• {nota}", ST["small_j"]))
    else:
        story.append(Paragraph(
            "Memoria de cálculo detalhada indisponível — setor não informado no momento da geração do PDF. "
            "Preencha todos os campos do comparador e gere novamente para obter o detalhamento completo.",
            ST["body"]))
    sec += 1

    # ── 7. CRONOGRAMA DE TRANSICAO ────────────────────────────────────────────
    story.extend(_cronograma_timeline_section(ST, sec, setor_obj, icms_uf))
    sec += 1

    # ── 8. O QUE MUDA COM A REFORMA ──────────────────────────────────────────
    story.extend(_reforma_section(ST, sec, comp, setor_obj, inp, melhor_key, icms_uf))
    sec += 1

    # ── ASSINATURA — sempre ao final de tudo ────────────────────────────────
    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=0.5, color=INK_100, spaceAfter=8))
    story.append(Paragraph(
        "Este estudo tem carater informativo e foi elaborado com base nos dados fornecidos "
        "e na legislacao vigente na data de emissão. Nao substitui a análise individualizada "
        "do contador responsavel. Decisões de mudança de regime tributário devem ser validadas "
        "por profissional habilitado antes de qualquer comunicacao a Receita Federal.",
        ST["disclaimer"]))
    story.append(Spacer(1, 14))
    story.append(Paragraph("______________________________", ST["body"]))
    if inp.contador_nome:
        story.append(Paragraph(inp.contador_nome, ST["body"]))
        if inp.contador_crc:
            story.append(Paragraph(f"CRC {inp.contador_crc}", ST["small"]))
    else:
        story.append(Paragraph("Conflex Contabilidade", ST["body"]))
        story.append(Paragraph(f"Data: {today}", ST["small"]))

    doc.multiBuild(story, onFirstPage=on_page, onLaterPages=on_page)
    return buf.getvalue()


# ─── Route ───────────────────────────────────────────────────────────────────
@router.post("/gerar-estudo-tributario")
def gerar_estudo_tributario(inp: EstudoInput):
    pdf_bytes = _build_pdf(inp)
    nome = inp.razao_social.replace(" ", "_")[:40]
    filename = f"Estudo_Tributário_{nome}_{inp.comparador.ano}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
