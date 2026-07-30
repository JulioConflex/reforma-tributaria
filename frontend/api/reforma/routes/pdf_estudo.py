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
        "h1":             s("H1",   fontName="Helvetica-Bold",    fontSize=13, textColor=INK_900, leading=18, spaceBefore=14, spaceAfter=5),
        "h2":             s("H2",   fontName="Helvetica-Bold",    fontSize=11, textColor=INK_900, leading=15, spaceBefore=10, spaceAfter=4),
        "h3":             s("H3",   fontName="Helvetica-Bold",    fontSize=10, textColor=INK_700, leading=14, spaceBefore=8,  spaceAfter=3),
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

def _mem_table_style(header_color=INK_700) -> TableStyle:
    return TableStyle([
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
    ])

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
                pres = 0.08 if tipo == "produto" else 0.32
                pres_csll = 0.12 if tipo == "produto" else 0.32
                irpj_formula = f"Presunção {int(pres*100)}% fat. × 15% (IRPJ) + {int(pres_csll*100)}% fat. × 9% (CSLL)"
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
        for d in res_novo.detalhes:
            aliq_txt = f"{d.aliquota_aplicada:.2f}%" if d.aliquota_aplicada else "—"
            formula_txt = d.formula or "—"
            style = ST["mem_info"] if d.informativo else ST["mem_formula"]
            val_style = ST["mem_info"] if d.informativo else ST["mem_valor"]
            info_suffix = " [informativo]" if d.informativo else ""
            row = [
                Paragraph(d.nome + info_suffix, ST["mem_nome"]),
                Paragraph(aliq_txt, ST["mem_aliq"]),
                Paragraph(formula_txt, style),
                Paragraph(brl(d.valor), val_style),
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
        t_n.setStyle(_mem_table_style(colors.HexColor("#059669")))
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

    elements.append(Spacer(1, 14))
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
        canvas.setFillColor(BRAND)
        canvas.rect(0, H - 8, W, 8, fill=1, stroke=0)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(INK_400)
        canvas.drawCentredString(W/2, 14, "Conflex Contabilidade — Rua XV de novembro, 1155, 10 Andar, Curitiba/PR — (41) 3277-1313")
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
        colWidths=[None, 5.6*cm],
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
    story.append(Spacer(1, 14))

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
    story.append(Spacer(1, 14))

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

    # ── 1. PERFIL FINANCEIRO ─────────────────────────────────────────────────
    sec = 1
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
    story.append(Paragraph(f"{sec}. Sistema Atual — Carga por Regime", ST["h1"]))
    story.append(Paragraph(
        f"Carga tributária por operação de {brl(comp.valor_base)}, incluindo IRPJ/CSLL atribuivel.",
        ST["body"]))

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
    t_a = Table(rows_a, colWidths=[7.5*cm, 4.0*cm, 4.0*cm, 3.0*cm])
    t_a.setStyle(_table_style())
    story.append(t_a)
    sec += 1

    # ── 3. COMPARATIVO — NOVO SISTEMA ────────────────────────────────────────
    story.append(Spacer(1, 14))
    story.append(Paragraph(f"{sec}. Novo Sistema ({comp.ano}) — Carga por Regime", ST["h1"]))
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
    t_n = Table(rows_n, colWidths=[7.5*cm, 4.0*cm, 4.0*cm, 3.0*cm])
    t_n.setStyle(_table_style(EMERALD))
    story.append(t_n)
    sec += 1

    # ── 4. VARIACAO ───────────────────────────────────────────────────────────
    story.append(Spacer(1, 14))
    story.append(Paragraph(f"{sec}. Variação: Sistema Atual x Novo Sistema", ST["h1"]))
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
    t_v = Table(rows_v, colWidths=[5.0*cm, 3.0*cm, 3.0*cm, 3.0*cm, 2.5*cm, 3.5*cm])
    t_v.setStyle(_table_style(INK_600))
    story.append(t_v)
    sec += 1

    # ── 5. DESTAQUE DO MELHOR REGIME ─────────────────────────────────────────
    melhor_obj = next((r for r in disponiveis if r.regime == melhor_key), None) if melhor_key else None
    if melhor_obj:
        story.append(Spacer(1, 14))
        story.append(KeepTogether([
            Paragraph(f"{sec}. Regime Mais Vantajoso para o Novo Sistema", ST["h1"]),
            ColorBar(EMERALD, height=3), Spacer(1, 8),
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
        sec += 1

    # ── 6. VARIACAO ANO A ANO (2026-2033) ────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph(f"{sec}. Evolução da Carga Tributária — Ano a Ano (2026-2033)", ST["h1"]))
    story.append(Paragraph(
        f"Projeção da carga tributária por operação de {brl(comp.valor_base)}, para cada regime "
        "disponível, ao longo da transição da Reforma Tributária. A redução do PIS/COFINS e "
        "ICMS/ISS e compensada pelo crescimento progressivo do CBS e IBS conforme o cronograma "
        "da LC 214/2025. Os valores incluem IRPJ/CSLL estimado atribuivel a operação.",
        ST["body_j"]))
    story.append(Spacer(1, 8))

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
        t_brl = Table(rows_brl, colWidths=col_w)
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
        story.append(Paragraph("Valor total dos tributos por operação (R$, sem centavos)", ST["label"]))
        story.append(Spacer(1, 3))
        story.append(t_brl)
        story.append(Spacer(1, 3))
        story.append(Paragraph(
            f"Coluna destacada em verde = ano de referencia ({comp.ano}). Valores sem R$ para melhor leitura. Inclui IRPJ/CSLL estimado.",
            ST["small"]))

        story.append(Spacer(1, 10))

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

        t_pct = Table(rows_pct, colWidths=col_w)
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
        story.append(Paragraph("Carga tributária como % do valor da operação", ST["label"]))
        story.append(Spacer(1, 3))
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
    story.append(PageBreak())
    story.append(Paragraph(f"{sec}. Memória de Cálculo — Detalhamento por Tributo e por Regime", ST["h1"]))
    story.append(Paragraph(
        f"Detalhamento completo de cada tributo nas duas fases (sistema atual e novo sistema em {comp.ano}), "
        f"para uma operação de {brl(comp.valor_base)} no setor {comp.setor}, UF {comp.uf}. "
        "Fórmulas com base legal citada. Valores de IRPJ/CSLL estimados proporcionalmente por operação.",
        ST["body_j"]))
    story.append(Spacer(1, 6))

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
    story.append(Spacer(1, 14))
    story.append(Paragraph(f"{sec}. Cronograma da Transição Tributária (2026-2033)", ST["h1"]))
    story.append(Paragraph(
        "Evolucao das alíquotas de CBS, IBS e dos fatores de transição conforme LC 214/2025.",
        ST["body"]))

    try:
        cron_rows = [[
            Paragraph("Ano", ST["cell_header"]),
            Paragraph("CBS (%)", ST["cell_header"]),
            Paragraph("IBS (%)", ST["cell_header"]),
            Paragraph("Fator IBS", ST["cell_header"]),
            Paragraph("Fator ICMS", ST["cell_header"]),
            Paragraph("Fator ISS", ST["cell_header"]),
            Paragraph("PIS/COFINS", ST["cell_header"]),
            Paragraph("Descrição", ST["cell_header_l"]),
        ]]
        for yr in range(2026, 2034):
            c = get_cronograma(yr)
            pis_txt = "Sim" if c.get("pis_cofins_ativo") else "Nao"
            cron_rows.append([
                Paragraph(str(yr), ST["cell_bold"]),
                Paragraph(f"{c['cbs_percentual']*100:.1f}%", ST["cell_r"]),
                Paragraph(f"{c['ibs_percentual']*100:.1f}%", ST["cell_r"]),
                Paragraph(f"{c['ibs_fator']*100:.0f}%", ST["cell_r"]),
                Paragraph(f"{c['icms_fator']*100:.0f}%", ST["cell_r"]),
                Paragraph(f"{c['iss_fator']*100:.0f}%", ST["cell_r"]),
                Paragraph(pis_txt, ST["cell_r"]),
                Paragraph(c.get("descricao", ""), ST["cell_l"]),
            ])
        t_cron = Table(cron_rows, colWidths=[1.6*cm, 1.4*cm, 1.4*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.7*cm, None])
        t_cron.setStyle(_table_style(BRAND))
        story.append(t_cron)
    except Exception:
        story.append(Paragraph("Cronograma indisponível.", ST["small"]))
    sec += 1

    # ── 8. REFORMA TRIBUTARIA ─────────────────────────────────────────────────
    story.append(Spacer(1, 14))
    story.append(Paragraph(f"{sec}. O que Muda com a Reforma Tributária", ST["h1"]))
    for titulo, texto in [
        ("A partir de 2027", "criacao da CBS, tributo federal que substitui o PIS e a COFINS."),
        ("A partir de 2029", "criacao do IBS, que substitui o ISS e o ICMS, com transição progressiva até 2032."),
        ("IRPJ e CSLL", "permanecem sem alteracao estrutural."),
        ("Simples Nacional", "continuara com guia unica (DAS), mas as regras de CBS/IBS ainda serao definidas pelo Comitê Gestor do IBS."),
    ]:
        story.append(Paragraph(f"<b>{titulo}:</b> {texto}", ST["body"]))
    story.append(Spacer(1, 6))
    if inp.perfil_clientes == "pj":
        cred_txt = (
            "<b>Atencao para clientes PJ/B2B:</b> As notas fiscais passarao a destacar CBS e IBS. "
            "Clientes do Lucro Real ou Presumido usarao esse valor como crédito tributário. "
            "No Simples Nacional, o crédito cedido e menor. O Simples Nacional Híbrido pode ser avaliado "
            "se a maioria dos clientes valorizar esse crédito — mas implica maior custo tributário."
        )
    elif inp.perfil_clientes == "misto":
        cred_txt = (
            "<b>Clientes com perfil misto (PF e PJ):</b> Para clientes PJ, o CBS/IBS da nota pode ser "
            "usado como crédito. Avalie o percentual de clientes PJ antes de considerar o Simples Híbrido."
        )
    else:
        cred_txt = (
            "Como os clientes sao majoritariamente pessoa fisica (B2C), o crédito CBS/IBS cedido ao cliente "
            "tem relevancia reduzida. A escolha de regime deve ser guiada pelo menor custo tributário."
        )
    story.append(Paragraph(cred_txt, ST["body_j"]))
    sec += 1

    # ── 9. CONCLUSAO ─────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph(f"{sec}. Conclusão e Recomendação", ST["h1"]))
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
                "substituira ISS/ICMS progressivamente até 2032. Os valores projetados sao estimativas — "
                "recomendamos revisar esta análise anualmente conforme as alíquotas definitivas forem publicadas."
            )
    elif "reforma" in objs:
        if melhor_obj2:
            conclusao = (
                f"Diante da Reforma Tributária (LC 214/2025), o regime mais vantajoso para "
                f"<b>{inp.razao_social}</b> em {comp.ano} e o <b>{melhor_obj2.nome}</b>, "
                f"com carga de <b>{brl(melhor_obj2.total_novo or 0)}</b> por operação de {brl(comp.valor_base)}. "
                "O CBS substituira PIS/COFINS a partir de 2027 e o IBS substituira ISS/ICMS progressivamente "
                "até 2032. Os valores apresentados sao estimativas — recomendamos revisar anualmente."
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

    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=INK_100, spaceAfter=10))
    story.append(Paragraph(
        "Este estudo tem carater informativo e foi elaborado com base nos dados fornecidos "
        "e na legislacao vigente na data de emissão. Nao substitui a análise individualizada "
        "do contador responsavel. Decisões de mudança de regime tributário devem ser validadas "
        "por profissional habilitado antes de qualquer comunicacao a Receita Federal.",
        ST["disclaimer"]))

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
    filename = f"Estudo_Tributário_{nome}_{inp.comparador.ano}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
