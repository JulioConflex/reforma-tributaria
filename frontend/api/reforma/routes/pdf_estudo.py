from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from io import BytesIO
import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether,
)
from reportlab.platypus.flowables import Flowable

router = APIRouter(prefix="/api/py", tags=["pdf"])

# ─── Palette ─────────────────────────────────────────────────────────────────
BRAND   = colors.HexColor("#0070F3")
BRAND_D = colors.HexColor("#004AC4")
EMERALD = colors.HexColor("#10B981")
AMBER   = colors.HexColor("#F59E0B")
RED_C   = colors.HexColor("#EF4444")
INK_900 = colors.HexColor("#111827")
INK_600 = colors.HexColor("#4B5563")
INK_400 = colors.HexColor("#9CA3AF")
INK_100 = colors.HexColor("#F3F4F6")
INK_50  = colors.HexColor("#F9FAFB")
WHITE   = colors.white


# ─── Helpers ─────────────────────────────────────────────────────────────────
def brl(value: float) -> str:
    abs_v = abs(value)
    s = f"R$ {abs_v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-{s}" if value < 0 else s


def pct(value: float, decimals: int = 2) -> str:
    return f"{value:.{decimals}f}%"


def _styles():
    base = getSampleStyleSheet()

    def s(name, **kw):
        return ParagraphStyle(name, **kw)

    return {
        "title": s("T", fontName="Helvetica-Bold", fontSize=26, textColor=INK_900,
                   leading=30, spaceAfter=4),
        "subtitle": s("ST", fontName="Helvetica", fontSize=13, textColor=INK_600,
                      leading=18, spaceAfter=2),
        "client": s("CL", fontName="Helvetica-Bold", fontSize=16, textColor=BRAND,
                    leading=20, spaceAfter=2),
        "h1": s("H1", fontName="Helvetica-Bold", fontSize=13, textColor=INK_900,
                leading=18, spaceBefore=14, spaceAfter=5),
        "h2": s("H2", fontName="Helvetica-Bold", fontSize=11, textColor=INK_900,
                leading=15, spaceBefore=10, spaceAfter=4),
        "label": s("LBL", fontName="Helvetica-Bold", fontSize=9, textColor=INK_600,
                   leading=12, spaceAfter=1),
        "body": s("BD", fontName="Helvetica", fontSize=10, textColor=INK_600,
                  leading=15, spaceAfter=4),
        "body_j": s("BDJ", fontName="Helvetica", fontSize=10, textColor=INK_600,
                    leading=15, spaceAfter=4, alignment=TA_JUSTIFY),
        "small": s("SM", fontName="Helvetica", fontSize=8.5, textColor=INK_400,
                   leading=12, spaceAfter=3),
        "badge_ok": s("BOK", fontName="Helvetica-Bold", fontSize=8, textColor=EMERALD,
                      leading=10),
        "badge_no": s("BNO", fontName="Helvetica-Bold", fontSize=8, textColor=INK_400,
                      leading=10),
        "footer": s("FT", fontName="Helvetica", fontSize=8, textColor=INK_400,
                    alignment=TA_CENTER, leading=12),
        "disclaimer": s("DS", fontName="Helvetica-Oblique", fontSize=8, textColor=INK_400,
                        leading=12, spaceBefore=6, spaceAfter=6, alignment=TA_JUSTIFY),
        "cell_l": s("CL_L", fontName="Helvetica", fontSize=9.5, textColor=INK_900,
                    leading=13),
        "cell_r": s("CL_R", fontName="Helvetica", fontSize=9.5, textColor=INK_900,
                    leading=13, alignment=TA_RIGHT),
        "cell_bold": s("CL_B", fontName="Helvetica-Bold", fontSize=9.5, textColor=INK_900,
                       leading=13),
        "cell_bold_r": s("CL_BR", fontName="Helvetica-Bold", fontSize=9.5, textColor=INK_900,
                         leading=13, alignment=TA_RIGHT),
        "cell_green_r": s("CL_GR", fontName="Helvetica-Bold", fontSize=9.5, textColor=EMERALD,
                          leading=13, alignment=TA_RIGHT),
        "cell_red_r": s("CL_RR", fontName="Helvetica-Bold", fontSize=9.5, textColor=RED_C,
                        leading=13, alignment=TA_RIGHT),
        "cell_header": s("CH", fontName="Helvetica-Bold", fontSize=8.5, textColor=WHITE,
                         leading=12, alignment=TA_CENTER),
        "cell_header_l": s("CHL", fontName="Helvetica-Bold", fontSize=8.5, textColor=WHITE,
                            leading=12),
    }


def _table_style(header_color=BRAND, stripe=True) -> TableStyle:
    cmds = [
        ("BACKGROUND",  (0, 0), (-1, 0), header_color),
        ("TEXTCOLOR",   (0, 0), (-1, 0), WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, INK_50] if stripe else [WHITE]),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",  (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW",   (0, 0), (-1, 0), 0.5, header_color),
        ("LINEBELOW",   (0, 1), (-1, -2), 0.3, INK_100),
        ("ROWBACKGROUNDS", (0, 0), (-1, 0), [header_color]),
    ]
    return TableStyle(cmds)


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


# ─── Pydantic input schema ────────────────────────────────────────────────────
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
    premissas: str = ""
    objetivos: str = ""
    observacoes: str = ""
    contador_nome: str = ""
    contador_crc: str = ""
    comparador: ComparadorData


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
        # top stripe
        canvas.setFillColor(BRAND)
        canvas.rect(0, H - 8, W, 8, fill=1, stroke=0)
        # footer
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(INK_400)
        canvas.drawCentredString(W / 2, 14, "Conflex Contabilidade — Rua XV de novembro, 1155, 10° Andar, Curitiba/PR — (41) 3277-1313")
        canvas.drawRightString(W - margin, 14, f"Pág. {doc.page}")
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
    story.append(Paragraph("Estudo Tributário", ST["title"]))
    story.append(Paragraph("Análise Comparativa de Regimes — Sistema Atual e Reforma Tributária", ST["subtitle"]))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=INK_100, spaceAfter=12))

    info_data = [
        [Paragraph("<b>Empresa</b>", ST["cell_bold"]),
         Paragraph(inp.razao_social, ST["cell_l"])],
    ]
    if inp.cnpj:
        info_data.append([Paragraph("<b>CNPJ</b>", ST["cell_bold"]),
                          Paragraph(inp.cnpj, ST["cell_l"])])
    info_data += [
        [Paragraph("<b>Setor</b>", ST["cell_bold"]),
         Paragraph(comp.setor, ST["cell_l"])],
        [Paragraph("<b>Estado</b>", ST["cell_bold"]),
         Paragraph(comp.uf, ST["cell_l"])],
        [Paragraph("<b>Ano de referência</b>", ST["cell_bold"]),
         Paragraph(str(comp.ano), ST["cell_l"])],
        [Paragraph("<b>Faturamento anual</b>", ST["cell_bold"]),
         Paragraph(brl(inp.faturamento_anual), ST["cell_l"])],
        [Paragraph("<b>Data de emissão</b>", ST["cell_bold"]),
         Paragraph(today, ST["cell_l"])],
    ]
    info_t = Table(info_data, colWidths=[5.0 * cm, None])
    info_t.setStyle(TableStyle([
        ("VALIGN",      (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW",   (0, 0), (-1, -2), 0.3, INK_100),
    ]))
    story.append(info_t)
    story.append(Spacer(1, 14))

    intro = (
        "Este estudo compara os regimes de tributação disponíveis no Brasil (MEI, "
        "Simples Nacional, Lucro Presumido e Lucro Real), analisando o impacto do "
        "sistema atual e do novo sistema tributário (Reforma — LC 214/2025) sobre "
        "a carga tributária da empresa. Os cálculos usam a legislação vigente; "
        "mudanças futuras na lei não estão contempladas aqui."
    )
    story.append(Paragraph(intro, ST["body_j"]))

    if comp.valores_projetados:
        story.append(Spacer(1, 6))
        aviso = (
            "<b>Atenção:</b> As alíquotas de referência do IBS (~18,7%) e CBS (~9,3%) "
            "ainda não foram confirmadas pelo Senado Federal. Os valores apresentados "
            "para o novo sistema são estimativas sujeitas a alteração."
        )
        story.append(Paragraph(aviso, ST["small"]))

    # ── 1. PREMISSAS E DADOS ─────────────────────────────────────────────────
    if inp.premissas or inp.objetivos or inp.despesas_mensais is not None:
        story.append(Spacer(1, 6))
        story.append(Paragraph("1. Premissas e Objetivos", ST["h1"]))

        if inp.premissas:
            story.append(Paragraph("<b>Premissas informadas:</b>", ST["label"]))
            story.append(Paragraph(inp.premissas.replace("\n", "<br/>"), ST["body"]))

        if inp.objetivos:
            story.append(Paragraph("<b>Objetivos do estudo:</b>", ST["label"]))
            story.append(Paragraph(inp.objetivos.replace("\n", "<br/>"), ST["body"]))

        if inp.despesas_mensais is not None:
            story.append(Paragraph(
                f"<b>Despesas médias mensais (Lucro Real):</b> {brl(inp.despesas_mensais)}", ST["body"]))

    # ── 2. COMPARATIVO — SISTEMA ATUAL ───────────────────────────────────────
    story.append(Spacer(1, 4))
    story.append(Paragraph("2. Sistema Atual — Carga por Regime", ST["h1"]))
    story.append(Paragraph(
        f"Carga tributária por operação de {brl(comp.valor_base)}, incluindo IRPJ/CSLL atribuível.",
        ST["body"]))

    hdr = [
        Paragraph("Regime", ST["cell_header_l"]),
        Paragraph("Carga Total", ST["cell_header"]),
        Paragraph("% s/ Operação", ST["cell_header"]),
        Paragraph("Situação", ST["cell_header"]),
    ]
    rows_atual = [hdr]
    for r in comp.comparativo:
        is_best = r.regime == melhor_key and r.disponivel
        nome_p = Paragraph(f"<b>{r.nome}</b>" if is_best else r.nome, ST["cell_bold"] if is_best else ST["cell_l"])
        if r.disponivel:
            val_p = Paragraph(brl(r.total_atual or 0),
                              ST["cell_green_r"] if is_best else ST["cell_r"])
            pct_p = Paragraph(pct(r.percentual_atual or 0), ST["cell_r"])
            sit_p = Paragraph("Disponivel", ST["badge_ok"])
        else:
            val_p = Paragraph("—", ST["cell_r"])
            pct_p = Paragraph("—", ST["cell_r"])
            sit_p = Paragraph("Vedado", ST["badge_no"])
        rows_atual.append([nome_p, val_p, pct_p, sit_p])

    t_atual = Table(rows_atual, colWidths=[7.5 * cm, 4.0 * cm, 4.0 * cm, 3.0 * cm])
    t_atual.setStyle(_table_style())
    story.append(t_atual)

    # ── 3. COMPARATIVO — NOVO SISTEMA ────────────────────────────────────────
    story.append(Spacer(1, 14))
    story.append(Paragraph(f"3. Novo Sistema ({comp.ano}) — Carga por Regime", ST["h1"]))
    story.append(Paragraph(
        f"Carga tributária estimada após a Reforma Tributária (LC 214/2025), para o ano {comp.ano}.",
        ST["body"]))

    hdr_n = [
        Paragraph("Regime", ST["cell_header_l"]),
        Paragraph("Carga Nova", ST["cell_header"]),
        Paragraph("% s/ Operação", ST["cell_header"]),
        Paragraph("Ranking", ST["cell_header"]),
    ]
    rows_novo = [hdr_n]
    sorted_disp = sorted(disponiveis, key=lambda x: x.total_novo or 0)
    ranking = {r.regime: i + 1 for i, r in enumerate(sorted_disp)}

    for r in comp.comparativo:
        is_best = r.regime == melhor_key and r.disponivel
        nome_p = Paragraph(f"<b>{r.nome}</b>" if is_best else r.nome, ST["cell_bold"] if is_best else ST["cell_l"])
        if r.disponivel:
            rank = ranking.get(r.regime, "—")
            rank_txt = f"#{rank}" + (" (Melhor)" if is_best else "")
            val_p = Paragraph(brl(r.total_novo or 0),
                              ST["cell_green_r"] if is_best else ST["cell_r"])
            pct_p = Paragraph(pct(r.percentual_novo or 0), ST["cell_r"])
            rk_p = Paragraph(rank_txt, ST["badge_ok"] if is_best else ST["cell_l"])
        else:
            val_p = Paragraph("—", ST["cell_r"])
            pct_p = Paragraph("—", ST["cell_r"])
            rk_p = Paragraph("Vedado", ST["badge_no"])
        rows_novo.append([nome_p, val_p, pct_p, rk_p])

    t_novo = Table(rows_novo, colWidths=[7.5 * cm, 4.0 * cm, 4.0 * cm, 3.0 * cm])
    t_novo.setStyle(_table_style(EMERALD))
    story.append(t_novo)

    # ── 4. VARIAÇÃO (atual → novo) ────────────────────────────────────────────
    story.append(Spacer(1, 14))
    story.append(Paragraph("4. Variação: Sistema Atual → Novo Sistema", ST["h1"]))

    hdr_v = [
        Paragraph("Regime", ST["cell_header_l"]),
        Paragraph("Atual", ST["cell_header"]),
        Paragraph("Novo", ST["cell_header"]),
        Paragraph("Diferença", ST["cell_header"]),
        Paragraph("Var. %", ST["cell_header"]),
        Paragraph("Econ./Ano est.", ST["cell_header"]),
    ]
    rows_var = [hdr_v]
    for r in comp.comparativo:
        is_best = r.regime == melhor_key and r.disponivel
        nome_p = Paragraph(f"<b>{r.nome}</b>" if is_best else r.nome, ST["cell_bold"] if is_best else ST["cell_l"])
        if r.disponivel:
            diff = r.diferenca or 0
            diff_style = ST["cell_red_r"] if diff > 0 else ST["cell_green_r"]
            diff_pct = r.diferenca_percentual or 0
            prefix = "+" if diff > 0 else ""
            eco = r.economia_anual_estimada or 0
            eco_style = ST["cell_green_r"] if eco < 0 else ST["cell_red_r"]

            rows_var.append([
                nome_p,
                Paragraph(brl(r.total_atual or 0), ST["cell_r"]),
                Paragraph(brl(r.total_novo or 0), ST["cell_green_r"] if is_best else ST["cell_r"]),
                Paragraph(f"{prefix}{brl(diff)}", diff_style),
                Paragraph(f"{prefix}{pct(diff_pct, 1)}", diff_style),
                Paragraph(brl(eco), eco_style),
            ])
        else:
            rows_var.append([nome_p] + [Paragraph("—", ST["cell_r"])] * 5)

    t_var = Table(rows_var, colWidths=[5.5 * cm, 3.0 * cm, 3.0 * cm, 3.0 * cm, 2.5 * cm, 3.5 * cm])
    t_var.setStyle(_table_style(INK_600))
    story.append(t_var)

    # ── 5. DESTAQUE DO MELHOR REGIME ─────────────────────────────────────────
    if melhor_key and disponiveis:
        story.append(Spacer(1, 14))
        melhor_obj = next((r for r in disponiveis if r.regime == melhor_key), None)
        if melhor_obj:
            story.append(KeepTogether([
                Paragraph("5. Regime Mais Vantajoso para o Novo Sistema", ST["h1"]),
                ColorBar(EMERALD, height=3),
                Spacer(1, 8),
            ]))

            # Economia vs pior disponivel
            pior = max(disponiveis, key=lambda x: x.total_novo or 0)
            economia_op = (pior.total_novo or 0) - (melhor_obj.total_novo or 0)
            economia_anual = (economia_op / comp.valor_base * inp.faturamento_anual
                              if comp.valor_base > 0 else 0)

            dest_data = [
                [Paragraph("Regime recomendado", ST["cell_bold"]),
                 Paragraph(melhor_obj.nome, ST["cell_green_r"])],
                [Paragraph("Carga tributária (novo sistema)", ST["cell_bold"]),
                 Paragraph(brl(melhor_obj.total_novo or 0), ST["cell_green_r"])],
                [Paragraph("% sobre operação", ST["cell_bold"]),
                 Paragraph(pct(melhor_obj.percentual_novo or 0), ST["cell_r"])],
            ]
            if economia_anual > 0:
                dest_data.append([
                    Paragraph("Economia anual estimada vs pior opção", ST["cell_bold"]),
                    Paragraph(brl(economia_anual), ST["cell_green_r"]),
                ])
            if melhor_obj.irpj_csll_estimado and melhor_obj.irpj_csll_estimado > 0:
                dest_data.append([
                    Paragraph("IRPJ/CSLL incluído", ST["cell_bold"]),
                    Paragraph(brl(melhor_obj.irpj_csll_estimado), ST["cell_r"]),
                ])

            dest_t = Table(dest_data, colWidths=[9.0 * cm, None])
            dest_t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D1FAE5")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#ECFDF5")]),
                ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING",   (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING",  (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("LINEBELOW",    (0, 0), (-1, -2), 0.3, colors.HexColor("#A7F3D0")),
                ("BOX",          (0, 0), (-1, -1), 0.8, EMERALD),
                ("LINEBEFORE",   (0, 0), (0, -1), 3, EMERALD),
            ]))
            story.append(dest_t)

    # ── 6. REFORMA TRIBUTÁRIA ────────────────────────────────────────────────
    story.append(Spacer(1, 14))
    story.append(Paragraph("6. O que Muda com a Reforma Tributária", ST["h1"]))

    reforma_texto = [
        ("A partir de 2027", "criação da CBS, tributo federal que substitui o PIS e a COFINS."),
        ("A partir de 2029", "criação do IBS, que substitui o ISS e o ICMS, com transição progressiva até 2032."),
        ("IRPJ e CSLL", "permanecem sem alteração estrutural."),
        ("Simples Nacional", "continuará com guia única (DAS), mas as regras de cobrança de CBS/IBS ainda serão definidas pelo Comitê Gestor do IBS."),
    ]
    for titulo, texto in reforma_texto:
        row_p = Paragraph(f"<b>{titulo}:</b> {texto}", ST["body"])
        story.append(row_p)

    story.append(Spacer(1, 6))
    cred_txt = (
        "Um ponto relevante: as notas fiscais passarão a destacar CBS e IBS. "
        "Clientes do Lucro Real ou Presumido poderão usar esses valores como crédito "
        "tributário. Caso a empresa esteja no Simples Nacional, o crédito cedido ao "
        "cliente tende a ser menor. Se boa parte dos clientes for pessoa jurídica e "
        "valorizar esse crédito, o regime chamado Simples Nacional Híbrido — que "
        "recolhe CBS/IBS pela alíquota cheia em vez da reduzida do Simples — pode "
        "ser avaliado próximo a 2027, quando as regras estiverem definidas."
    )
    story.append(Paragraph(cred_txt, ST["body_j"]))

    # ── 7. CONCLUSÃO ─────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("7. Conclusão e Recomendação", ST["h1"]))

    if melhor_key and disponiveis:
        melhor_obj2 = next((r for r in disponiveis if r.regime == melhor_key), None)
        if melhor_obj2:
            conclusao = (
                f"Com base nos dados analisados, o regime mais vantajoso para "
                f"<b>{inp.razao_social}</b> no novo sistema tributário ({comp.ano}) "
                f"é o <b>{melhor_obj2.nome}</b>, com carga de "
                f"<b>{brl(melhor_obj2.total_novo or 0)}</b> por operação de "
                f"{brl(comp.valor_base)} ({pct(melhor_obj2.percentual_novo or 0)} sobre o valor)."
            )
            story.append(Paragraph(conclusao, ST["body_j"]))
            story.append(Spacer(1, 6))

    recomendacao_geral = (
        "Recomendamos revisar esta análise anualmente, ao fechar o balanço, "
        "para confirmar se o regime continua sendo a melhor opção à luz do "
        "faturamento, lucro e estrutura de despesas do período."
    )
    story.append(Paragraph(recomendacao_geral, ST["body_j"]))

    if inp.observacoes:
        story.append(Spacer(1, 8))
        story.append(Paragraph("<b>Observações adicionais:</b>", ST["label"]))
        story.append(Paragraph(inp.observacoes.replace("\n", "<br/>"), ST["body"]))

    # Disclaimer
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=INK_100, spaceAfter=10))
    story.append(Paragraph(
        "Este estudo tem caráter informativo e foi elaborado com base nos dados fornecidos "
        "e na legislação vigente na data de emissão. Não substitui a análise individualizada "
        "do contador responsável pela empresa. Decisões de mudança de regime tributário devem "
        "ser validadas por profissional habilitado antes de qualquer comunicação à Receita Federal.",
        ST["disclaimer"]))

    # Assinatura
    story.append(Spacer(1, 24))
    sig_data = [[
        Paragraph("______________________________", ST["body"]),
        Paragraph("", ST["body"]),
    ]]
    sig_t = Table(sig_data, colWidths=[10 * cm, None])
    sig_t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(sig_t)

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
