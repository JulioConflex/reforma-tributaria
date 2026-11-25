"""
Gerador de estudo tributário em HTML printável (A4, 14 páginas).
"""
from html import escape as _esc
from datetime import date
from typing import Optional
from pathlib import Path
from ..models.schemas import SimulacaoComProjecaoOutput

# ─── Logo (WebP real, base64) ──────────────────────────────────────────────
_B64_FILE = Path(__file__).parent.parent / "assets" / "conflex-logo-b64.txt"
_LOGO_B64 = _B64_FILE.read_text(encoding="ascii").strip()
_LOGO_SRC = f"data:image/webp;base64,{_LOGO_B64}"

_C_B64_FILE = Path(__file__).parent.parent / "assets" / "conflex-c-b64.txt"
_C_B64 = _C_B64_FILE.read_text(encoding="ascii").strip()
_C_SRC = f"data:image/png;base64,{_C_B64}"

# ─── Formatters ────────────────────────────────────────────────────────────

def _br(x: float) -> str:
    s = f"{x:,.2f}".replace(",", "§").replace(".", ",").replace("§", ".")
    return f"R$ {s}"

def _n(x: float, dec: int = 2) -> str:
    return f"{x:,.{dec}f}".replace(",", "§").replace(".", ",").replace("§", ".")

def _pct(x: float) -> str:
    return f"{x:.2f}%"

REGIME_LABEL = {
    "lucro_real": "Lucro Real",
    "lucro_presumido": "Lucro Presumido",
    "simples_nacional": "Simples Nacional",
    "mei": "MEI",
}

REGIME_COLOR = {
    "lucro_real": "#0A2540",
    "lucro_presumido": "#E8A838",
    "simples_nacional": "#17A589",
    "mei": "#9BA8C2",
}

# ─── Logo / Watermark ──────────────────────────────────────────────────────

# Logo em fundo escuro (capa): imagem direta — texto branco visível
LOGO_LIGHT = f'<img src="{_LOGO_SRC}" style="height:32px;display:block">'

# Logo em fundo branco (cabeçalhos): drop-shadow escuro torna texto branco visível
LOGO_DARK = f'<img src="{_LOGO_SRC}" style="height:20px;display:block;filter:drop-shadow(1px 0 0 #111) drop-shadow(-1px 0 0 #111) drop-shadow(0 1px 0 #111) drop-shadow(0 -1px 0 #111)">'

# Marca d'água centralizada na página
WM = (
    f'<img src="{_LOGO_SRC}" style="width:320px;position:absolute;top:50%;left:50%;'
    f'transform:translate(-50%,-50%) rotate(-15deg);opacity:0.04;'
    f'pointer-events:none;z-index:0;filter:grayscale(100%)">'
)

# ─── Layout helpers ────────────────────────────────────────────────────────

def _hdr(empresa: str) -> str:
    return (
        f'<div style="height:48px;padding:0 56px;display:flex;align-items:center;'
        f'justify-content:space-between;border-bottom:1px solid #DCE3EF;flex-shrink:0;background:white;position:relative;z-index:1">'
        f'<span style="font-size:10px;color:#9BA8C2">Estudo tributário · {_esc(empresa)}</span>'
        f'{LOGO_DARK}</div>'
    )

def _ftr(n: int) -> str:
    return (
        f'<div style="height:36px;padding:0 56px;display:flex;align-items:center;'
        f'justify-content:space-between;border-top:1px solid #DCE3EF;flex-shrink:0;position:relative;z-index:1">'
        f'<span style="font-size:9px;color:#C4CCE0">Rua XV de Novembro, 1155, 10º andar · Centro · Curitiba/PR · (41) 3277-1313 · conflex.com.br</span>'
        f'<span style="font-size:9px;color:#9BA8C2;font-weight:600">{n}</span></div>'
    )

def _wrap(body: str, pg: int, empresa: str) -> str:
    return (
        f'<div class="page" style="position:relative">'
        f'{_hdr(empresa)}'
        f'<div style="flex:1;overflow:hidden;padding:24px 56px 20px;display:flex;flex-direction:column;gap:16px;position:relative;z-index:1">{body}</div>'
        f'{_ftr(pg)}</div>'
    )

def _sec(num: str, title: str, sub: str = "") -> str:
    sub_h = f'<div style="font-size:11px;color:#9BA8C2;margin-top:6px">{_esc(sub)}</div>' if sub else ""
    return (
        f'<div>'
        f'<div style="font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#9BA8C2;margin-bottom:4px">Seção {_esc(num)}</div>'
        f'<h2 style="font-size:20px;font-weight:800;color:#0A2540;letter-spacing:-.02em">{_esc(title)}</h2>'
        f'<div style="width:40px;height:3px;background:#E8A838;border-radius:2px;margin-top:8px"></div>'
        f'{sub_h}</div>'
    )

# ─── Page generators ───────────────────────────────────────────────────────

def _p1_capa(empresa: str, r: SimulacaoComProjecaoOutput, today: str) -> str:
    regime = REGIME_LABEL.get(r.regime, r.regime)
    economia = r.economia_ou_acrescimo
    economia_sinal = "▲" if economia > 0 else "▼"
    economia_cor = "#1A6B3C" if economia < 0 else "#C0392B"
    economia_lbl = "economia" if economia < 0 else "acréscimo"

    return f'''<div class="page" style="background:#0A2540;display:flex;flex-direction:column;width:794px;height:1122px;position:relative;overflow:hidden">
  <!-- Decorative circles -->
  <svg style="position:absolute;top:-80px;right:-80px;opacity:.08" viewBox="0 0 400 400" width="400"><circle cx="200" cy="200" r="200" fill="#01D1FF"/></svg>
  <svg style="position:absolute;bottom:-120px;left:-60px;opacity:.06" viewBox="0 0 320 320" width="320"><circle cx="160" cy="160" r="160" fill="#01D1FF"/></svg>

  <!-- Top bar -->
  <div style="padding:28px 56px 0;flex-shrink:0;position:relative;z-index:1">{LOGO_LIGHT}</div>

  <!-- Main content -->
  <div style="flex:1;padding:0 56px;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:1">
    <div style="font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#01D1FF;margin-bottom:14px">PLANEJAMENTO TRIBUTÁRIO · LC 214/2025</div>
    <div style="font-size:68px;font-weight:800;color:white;letter-spacing:-.04em;line-height:1.05;margin-bottom:8px">Estudo<br>Tributário</div>
    <div style="width:60px;height:4px;background:#E8A838;border-radius:2px;margin-bottom:20px"></div>
    <div style="font-size:17px;color:#8BA3C2;line-height:1.6">Análise comparativa de regimes e impacto<br>da Reforma Tributária — Ano de referência {r.ano}</div>

    <!-- Client info -->
    <div style="margin-top:36px;background:rgba(255,255,255,.07);border-radius:14px;padding:20px 24px;border:1px solid rgba(255,255,255,.12)">
      <div style="display:flex;gap:32px;flex-wrap:wrap">
        <div>
          <div style="font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#01D1FF;margin-bottom:4px">EMPRESA</div>
          <div style="font-size:14px;font-weight:700;color:white">{_esc(empresa)}</div>
        </div>
        <div>
          <div style="font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#01D1FF;margin-bottom:4px">REGIME SIMULADO</div>
          <div style="font-size:14px;font-weight:700;color:white">{_esc(regime)}</div>
        </div>
        <div>
          <div style="font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#01D1FF;margin-bottom:4px">SETOR</div>
          <div style="font-size:14px;font-weight:700;color:white">{_esc(r.setor_nome)}</div>
        </div>
        <div>
          <div style="font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#01D1FF;margin-bottom:4px">UF</div>
          <div style="font-size:14px;font-weight:700;color:white">{_esc(r.uf)}</div>
        </div>
      </div>
    </div>

    <!-- KPIs -->
    <div style="margin-top:16px;display:flex;gap:12px">
      <div style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px 18px;border-top:3px solid #E8A838">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#8BA3C2;margin-bottom:4px">Base da Operação</div>
        <div style="font-size:18px;font-weight:800;color:white">{_br(r.valor_operacao)}</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px 18px;border-top:3px solid #334E6E">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#8BA3C2;margin-bottom:4px">Sistema Atual</div>
        <div style="font-size:18px;font-weight:800;color:white">{_pct(r.sistema_atual.percentual_sobre_valor)}</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px 18px;border-top:3px solid #01D1FF">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#8BA3C2;margin-bottom:4px">Sistema Novo ({r.ano})</div>
        <div style="font-size:18px;font-weight:800;color:white">{_pct(r.sistema_novo.percentual_sobre_valor)}</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px 18px;border-top:3px solid {economia_cor}">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#8BA3C2;margin-bottom:4px">Variação ({economia_lbl})</div>
        <div style="font-size:18px;font-weight:800;color:white">{economia_sinal} {_pct(abs(r.economia_percentual))}</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:0 56px 24px;flex-shrink:0;display:flex;justify-content:space-between;align-items:flex-end;position:relative;z-index:1">
    <div style="font-size:9px;color:#4A6080">Curitiba, {today} · Departamento de Planejamento Tributário · conflex.com.br</div>
    <div style="font-size:9px;font-weight:600;color:#8BA3C2">1</div>
  </div>
</div>'''


def _p2_sumario(empresa: str) -> str:
    sections = [
        ("1", "Capa", "1"),
        ("2", "Sumário", "2"),
        ("3", "Resumo Executivo — Métricas", "3"),
        ("4", "Gráficos — Carga Tributária", "4"),
        ("5", "Comparativo de Regimes", "5"),
        ("6", "Base Legal e Perfil Financeiro", "6"),
        ("7", "DRE — Impacto da Reforma", "7"),
        ("8", "Análise Detalhada por Regime", "8"),
        ("9", "Conclusão e Recomendação", "9"),
        ("10", "Evolução da Carga (2026–2033)", "10"),
        ("11", "Memória de Cálculo", "11"),
        ("12", "Cronograma da Transição", "12"),
        ("13", "O que Muda com a Reforma", "13"),
        ("14", "Direito a Crédito CBS/IBS", "14"),
    ]

    rows = ""
    for num, title, pg in sections:
        is_main = True
        rows += (
            f'<div style="display:flex;align-items:baseline;gap:4px;margin-bottom:{"12px" if is_main else "6px"}">'
            f'<span style="font-size:10px;font-weight:600;color:#334E6E;min-width:28px">{_esc(num)}.</span>'
            f'<span style="font-size:12px;font-weight:600;color:#0A2540;flex:1">{_esc(title)}</span>'
            f'<span style="border-bottom:1px dotted #DCE3EF;flex:1;margin:0 8px 3px"></span>'
            f'<span style="font-size:11px;font-weight:600;color:#334E6E">{_esc(pg)}</span>'
            f'</div>'
        )

    body = (
        _sec("2", "Sumário") +
        f'<div style="margin-top:8px">{rows}</div>'
        f'<div style="background:#F5F7FC;border-radius:8px;padding:12px 16px;border:1px solid #DCE3EF;margin-top:8px">'
        f'<div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#334E6E;margin-bottom:4px">Sobre este estudo</div>'
        f'<div style="font-size:10px;color:#6B7592;line-height:1.65">'
        f'Este estudo foi elaborado com base na simulação tributária do Sistema Reforma Tributária Conflex, '
        f'utilizando as premissas informadas para a empresa {_esc(empresa)} e as regras da LC 214/2025. '
        f'As alíquotas de CBS (8,8%) e IBS (19,2%) são provisórias e sujeitas a alteração. '
        f'Os valores projetados têm fins de planejamento e não constituem garantia de resultado.</div></div>'
    )
    return _wrap(body, 2, empresa)


def _p3_metricas(empresa: str, r: SimulacaoComProjecaoOutput, comparativo: dict) -> str:
    regime_atual = REGIME_LABEL.get(r.regime, r.regime)
    regime_cor = REGIME_COLOR.get(r.regime, "#0A2540")

    # Find recommended regime
    all_regimes = {r.regime: r.sistema_novo.percentual_sobre_valor}
    for rg, res in comparativo.items():
        all_regimes[rg] = res.sistema_novo.percentual_sobre_valor
    best_regime = min(all_regimes, key=all_regimes.get)
    regime_rec = REGIME_LABEL.get(best_regime, best_regime)
    regime_rec_cor = REGIME_COLOR.get(best_regime, "#0A2540")

    economia_abs = abs(r.economia_ou_acrescimo)
    economia_pct = abs(r.economia_percentual)
    is_economy = r.economia_ou_acrescimo < 0

    kpi_row = (
        f'<div style="display:flex;gap:10px">'
        f'<div style="flex:1;border:1px solid #DCE3EF;border-radius:10px;padding:12px 14px;border-top:3px solid #334E6E">'
        f'<div style="font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9BA8C2;margin-bottom:5px">Base da Operação</div>'
        f'<div style="font-size:17px;font-weight:800;color:#0A2540">{_br(r.valor_operacao)}</div></div>'
        f'<div style="flex:1;border:1px solid #DCE3EF;border-radius:10px;padding:12px 14px;border-top:3px solid {regime_cor}">'
        f'<div style="font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9BA8C2;margin-bottom:5px">Sistema Atual</div>'
        f'<div style="font-size:17px;font-weight:800;color:#0A2540">{_br(r.sistema_atual.total)}</div>'
        f'<div style="font-size:10px;color:#9BA8C2;margin-top:2px">{_pct(r.sistema_atual.percentual_sobre_valor)} do faturamento</div></div>'
        f'<div style="flex:1;border:1px solid #DCE3EF;border-radius:10px;padding:12px 14px;border-top:3px solid #01D1FF">'
        f'<div style="font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9BA8C2;margin-bottom:5px">Sistema Novo ({r.ano})</div>'
        f'<div style="font-size:17px;font-weight:800;color:#0A2540">{_br(r.sistema_novo.total)}</div>'
        f'<div style="font-size:10px;color:#9BA8C2;margin-top:2px">{_pct(r.sistema_novo.percentual_sobre_valor)} do faturamento</div></div>'
        f'<div style="flex:1;border:1px solid #DCE3EF;border-radius:10px;padding:12px 14px;border-top:3px solid {"#1A6B3C" if is_economy else "#C0392B"}">'
        f'<div style="font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9BA8C2;margin-bottom:5px">{"Economia" if is_economy else "Acréscimo"}</div>'
        f'<div style="font-size:17px;font-weight:800;color:{"#1A6B3C" if is_economy else "#C0392B"}">{"▼" if is_economy else "▲"} {_br(economia_abs)}</div>'
        f'<div style="font-size:10px;color:#9BA8C2;margin-top:2px">{_pct(economia_pct)} da carga atual</div></div>'
        f'</div>'
    )

    regime_cards = (
        f'<div style="display:flex;gap:10px">'
        f'<div style="flex:1;border:1px solid #DCE3EF;border-radius:10px;padding:14px 16px">'
        f'<div style="font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9BA8C2;margin-bottom:5px">Regime Simulado</div>'
        f'<div style="font-size:14px;font-weight:700;color:#0A2540">{_esc(regime_atual)}</div>'
        f'<div style="font-size:10px;color:#6B7592;margin-top:2px">Regime informado para análise</div></div>'
        f'<div style="flex:1;border:1px solid #DCE3EF;border-radius:10px;padding:14px 16px;background:#EDF7F2;border-color:#B6E0C8">'
        f'<div style="font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#2E7D52;margin-bottom:5px">Regime Recomendado</div>'
        f'<div style="font-size:14px;font-weight:700;color:#0A2540">{_esc(regime_rec)}</div>'
        f'<div style="font-size:10px;color:#2E7D52;margin-top:2px">Menor carga no sistema novo</div></div>'
        f'</div>'
    )

    mc = r.memoria_calculo
    mc_note = ""
    if mc:
        mc_note = (
            f'<div style="background:#FFFBF0;border-left:3px solid #E8A838;border-radius:0 8px 8px 0;padding:10px 14px">'
            f'<div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9A6B00;margin-bottom:3px">Premissas utilizadas</div>'
            f'<div style="font-size:10px;color:#6B5700;line-height:1.6">'
            f'Crédito entrada: {_pct(mc.percentual_credito_entrada * 100)} · '
            f'CBS: {_pct(mc.cbs_percentual * 100)} · IBS: {_pct(mc.ibs_percentual * 100)} · '
            f'Redução setorial: {_pct(mc.reducao_setor * 100)} · UF: {_esc(r.uf)} · Setor: {_esc(r.setor_nome)}'
            f'</div></div>'
        )

    body = _sec("3", "Resumo Executivo", f"Base: {_br(r.valor_operacao)} · Regime: {regime_atual} · Setor: {r.setor_nome}") + kpi_row + regime_cards + mc_note
    return _wrap(body, 3, empresa)


def _p4_graficos(empresa: str, r: SimulacaoComProjecaoOutput, comparativo: dict) -> str:
    # Build bar chart data: all regimes, atual vs novo
    regimes_order = ["lucro_real", "lucro_presumido", "simples_nacional"]
    all_results = {r.regime: r}
    all_results.update(comparativo)

    bars = []
    for rg in regimes_order:
        if rg in all_results:
            res = all_results[rg]
            bars.append({
                "label": REGIME_LABEL.get(rg, rg),
                "cor": REGIME_COLOR.get(rg, "#334E6E"),
                "atual_pct": res.sistema_atual.percentual_sobre_valor,
                "novo_pct": res.sistema_novo.percentual_sobre_valor,
            })

    # SVG bar chart
    chart_w, chart_h = 640, 180
    max_pct = max(max(b["atual_pct"], b["novo_pct"]) for b in bars) if bars else 30
    max_pct = max(max_pct * 1.15, 5)
    n_groups = len(bars)
    group_w = chart_w / max(n_groups, 1)
    bar_w = min(50, group_w * 0.3)
    gap = bar_w * 0.5

    bar_rects = ""
    labels = ""
    for i, b in enumerate(bars):
        cx = group_w * i + group_w / 2
        x1 = cx - bar_w - gap / 2
        x2 = cx + gap / 2

        def bar_h_px(pct):
            return max(2, (pct / max_pct) * chart_h)

        h1 = bar_h_px(b["atual_pct"])
        h2 = bar_h_px(b["novo_pct"])
        y1 = chart_h - h1
        y2 = chart_h - h2

        bar_rects += (
            f'<rect x="{x1:.1f}" y="{y1:.1f}" width="{bar_w:.1f}" height="{h1:.1f}" fill="{b["cor"]}" rx="3" opacity=".85"/>'
            f'<rect x="{x2:.1f}" y="{y2:.1f}" width="{bar_w:.1f}" height="{h2:.1f}" fill="#01D1FF" rx="3" opacity=".9"/>'
            f'<text x="{x1 + bar_w/2:.1f}" y="{y1 - 4:.1f}" text-anchor="middle" font-size="9" fill="{b["cor"]}" font-weight="600">{b["atual_pct"]:.1f}%</text>'
            f'<text x="{x2 + bar_w/2:.1f}" y="{y2 - 4:.1f}" text-anchor="middle" font-size="9" fill="#0A6B8A" font-weight="600">{b["novo_pct"]:.1f}%</text>'
        )
        labels += f'<text x="{cx:.1f}" y="{chart_h + 16:.1f}" text-anchor="middle" font-size="10" fill="#334E6E" font-weight="600">{_esc(b["label"])}</text>'

    # Y-axis grid lines
    grid = ""
    for step in [5, 10, 15, 20, 25, 30]:
        if step > max_pct:
            break
        y = chart_h - (step / max_pct) * chart_h
        grid += (
            f'<line x1="0" y1="{y:.1f}" x2="{chart_w}" y2="{y:.1f}" stroke="#DCE3EF" stroke-width="1"/>'
            f'<text x="-6" y="{y + 3:.1f}" text-anchor="end" font-size="8" fill="#9BA8C2">{step}%</text>'
        )

    bar_svg = (
        f'<svg viewBox="-30 -10 {chart_w + 40} {chart_h + 36}" style="width:100%;max-height:200px">'
        f'{grid}{bar_rects}{labels}'
        f'</svg>'
    )

    # Line chart: projeção over years
    proj = r.projecao_2026_2033
    lc_w, lc_h = 640, 160
    if proj:
        pcts_novo = [p.percentual_sobre_valor for p in proj]
        pcts_atual = [(p.total_sistema_atual / r.valor_operacao * 100) if r.valor_operacao else 0 for p in proj]
        all_vals = pcts_novo + pcts_atual
        ymin = max(0, min(all_vals) - 2)
        ymax = max(all_vals) + 3

        def sy(pct):
            return lc_h - ((pct - ymin) / max(ymax - ymin, 1)) * lc_h

        def sx(i):
            return i * lc_w / max(len(proj) - 1, 1)

        pts_novo = " ".join(f"{sx(i):.1f},{sy(p):.1f}" for i, p in enumerate(pcts_novo))
        pts_atual = " ".join(f"{sx(i):.1f},{sy(p):.1f}" for i, p in enumerate(pcts_atual))

        # Find 2029 highlight
        anos = [p.ano for p in proj]
        highlight_x = sx(anos.index(r.ano)) if r.ano in anos else None
        highlight_band = ""
        if highlight_x is not None:
            bx = highlight_x - 15
            highlight_band = f'<rect x="{bx:.1f}" y="0" width="30" height="{lc_h}" fill="#EDF5FF" rx="4"/>'

        x_labels = ""
        for i, p in enumerate(proj):
            x_labels += f'<text x="{sx(i):.1f}" y="{lc_h + 14:.1f}" text-anchor="middle" font-size="8" fill="#9BA8C2">{p.ano}</text>'

        line_svg = (
            f'<svg viewBox="-30 -10 {lc_w + 40} {lc_h + 30}" style="width:100%;max-height:180px">'
            f'{highlight_band}'
            f'<polyline points="{pts_atual}" fill="none" stroke="#DCE3EF" stroke-width="1.5" stroke-dasharray="4,3"/>'
            f'<polyline points="{pts_novo}" fill="none" stroke="#01D1FF" stroke-width="2.5"/>'
            f'{x_labels}</svg>'
        )

        line_note = (
            f'<div style="display:flex;gap:12px;margin-top:4px">'
            f'<div style="display:flex;align-items:center;gap:5px"><div style="width:18px;height:2px;border-top:1.5px dashed #DCE3EF"></div><span style="font-size:9px;color:#9BA8C2">Sistema atual (referência)</span></div>'
            f'<div style="display:flex;align-items:center;gap:5px"><div style="width:18px;height:2.5px;background:#01D1FF;border-radius:1px"></div><span style="font-size:9px;color:#9BA8C2">Sistema novo (IBS+CBS)</span></div>'
            f'</div>'
        )
    else:
        line_svg = ""
        line_note = ""

    legend = (
        f'<div style="display:flex;gap:12px;margin-top:4px">'
        f'<div style="display:flex;align-items:center;gap:5px"><div style="width:14px;height:12px;background:#334E6E;border-radius:2px;opacity:.85"></div><span style="font-size:9px;color:#9BA8C2">Sistema atual</span></div>'
        f'<div style="display:flex;align-items:center;gap:5px"><div style="width:14px;height:12px;background:#01D1FF;border-radius:2px;opacity:.9"></div><span style="font-size:9px;color:#9BA8C2">Sistema novo ({r.ano})</span></div>'
        f'</div>'
    )

    body = (
        _sec("4", "Gráficos — Carga Tributária", "Comparativo de regimes e evolução no tempo") +
        f'<div>'
        f'<div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:6px">Carga tributária por regime (%)</div>'
        f'{bar_svg}{legend}</div>' +
        (f'<div style="margin-top:4px">'
         f'<div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:6px">Evolução da carga — {r.regime.replace("_", " ").title()} (2026–2033)</div>'
         f'{line_svg}{line_note}</div>' if line_svg else "")
    )
    return _wrap(body, 4, empresa)


def _p5_comparativo(empresa: str, r: SimulacaoComProjecaoOutput, comparativo: dict) -> str:
    regimes_order = ["lucro_real", "lucro_presumido", "simples_nacional"]
    all_results = {r.regime: r}
    all_results.update(comparativo)

    def _regime_badge(rg: str) -> str:
        cor = REGIME_COLOR.get(rg, "#334E6E")
        return f'<span style="display:inline-block;padding:2px 7px;background:{cor}20;border-radius:3px;font-size:9px;font-weight:600;color:{cor}">{REGIME_LABEL.get(rg, rg)}</span>'

    # Build comparison table
    thead = (
        f'<tr>'
        f'<th style="text-align:left;width:170px">Regime</th>'
        f'<th class="r">Sistema Atual (R$)</th>'
        f'<th class="r">Sistema Atual (%)</th>'
        f'<th class="r">Sistema Novo (R$)</th>'
        f'<th class="r">Sistema Novo (%)</th>'
        f'<th class="r">Variação</th>'
        f'</tr>'
    )
    tbody = ""
    for rg in regimes_order:
        if rg not in all_results:
            continue
        res = all_results[rg]
        var = res.economia_ou_acrescimo
        var_pct = res.economia_percentual
        is_eco = var < 0
        var_cor = "#1A6B3C" if is_eco else "#C0392B"
        is_this = rg == r.regime
        highlight = 'style="background:#F5FFFE"' if is_this else ""
        tbody += (
            f'<tr {highlight}>'
            f'<td style="font-weight:{"700" if is_this else "500"};color:#0A2540">{_regime_badge(rg)}</td>'
            f'<td class="r">{_n(res.sistema_atual.total)}</td>'
            f'<td class="r">{_pct(res.sistema_atual.percentual_sobre_valor)}</td>'
            f'<td class="r;font-weight:600">{_n(res.sistema_novo.total)}</td>'
            f'<td class="r">{_pct(res.sistema_novo.percentual_sobre_valor)}</td>'
            f'<td class="r" style="font-weight:700;color:{var_cor}">{"▼" if is_eco else "▲"} {_pct(abs(var_pct))}</td>'
            f'</tr>'
        )

    table_css = (
        '<style>table.cmp{width:100%;border-collapse:collapse}'
        'table.cmp th{font-size:9px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#9BA8C2;padding:7px 10px;border-bottom:2px solid #DCE3EF;text-align:left}'
        'table.cmp th.r{text-align:right}'
        'table.cmp td{font-size:11px;padding:9px 10px;border-bottom:1px solid #F0F3F8;font-variant-numeric:tabular-nums}'
        'table.cmp td.r{text-align:right}</style>'
    )

    # Detail tables for each regime in the new system
    detail_rows = ""
    for rg in regimes_order:
        if rg not in all_results:
            continue
        res = all_results[rg]
        cor = REGIME_COLOR.get(rg, "#334E6E")
        lbl = REGIME_LABEL.get(rg, rg)
        rows_d = ""
        for d in res.sistema_novo.detalhes:
            rows_d += (
                f'<tr><td style="color:#6B7592;font-size:10px;padding:5px 10px;border-bottom:1px solid #F0F3F8">{_esc(d.nome)}</td>'
                f'<td style="text-align:right;font-size:10px;padding:5px 10px;border-bottom:1px solid #F0F3F8">{_pct(d.aliquota_aplicada)}</td>'
                f'<td style="text-align:right;font-weight:600;font-size:10px;padding:5px 10px;border-bottom:1px solid #F0F3F8;font-variant-numeric:tabular-nums">{_n(d.valor)}</td></tr>'
            )
        rows_d += (
            f'<tr style="background:#F5F7FC;font-weight:700"><td style="font-size:10px;padding:5px 10px;color:#0A2540">Total</td><td></td>'
            f'<td style="text-align:right;font-size:10px;padding:5px 10px;color:{cor};font-variant-numeric:tabular-nums">{_n(res.sistema_novo.total)}</td></tr>'
        )
        detail_rows += (
            f'<div style="border:1px solid #DCE3EF;border-radius:8px;overflow:hidden;border-left:3px solid {cor}">'
            f'<div style="padding:7px 12px;background:#F9FAFB;font-size:10px;font-weight:700;color:{cor}">{_esc(lbl)}'
            f'<span style="font-weight:400;color:#9BA8C2;margin-left:8px">{_pct(res.sistema_novo.percentual_sobre_valor)} da operação</span></div>'
            f'<table style="width:100%;border-collapse:collapse">'
            f'<thead><tr>'
            f'<th style="font-size:8px;text-transform:uppercase;color:#9BA8C2;padding:5px 10px;border-bottom:1px solid #DCE3EF;text-align:left">Tributo</th>'
            f'<th style="font-size:8px;text-transform:uppercase;color:#9BA8C2;padding:5px 10px;border-bottom:1px solid #DCE3EF;text-align:right">Alíq.</th>'
            f'<th style="font-size:8px;text-transform:uppercase;color:#9BA8C2;padding:5px 10px;border-bottom:1px solid #DCE3EF;text-align:right">R$</th>'
            f'</tr></thead>'
            f'<tbody>{rows_d}</tbody></table></div>'
        )

    body = (
        table_css +
        _sec("5", "Comparativo de Regimes", f"Base: {_br(r.valor_operacao)} · Ano: {r.ano}") +
        f'<table class="cmp"><thead>{thead}</thead><tbody>{tbody}</tbody></table>' +
        f'<div style="font-size:10px;font-weight:700;color:#0A2540;margin-top:4px;margin-bottom:8px">Composição do Sistema Novo por Regime</div>' +
        f'<div style="display:flex;flex-direction:column;gap:6px">{detail_rows}</div>'
    )
    return _wrap(body, 5, empresa)


def _p6_base_legal(empresa: str, r: SimulacaoComProjecaoOutput) -> str:
    mc = r.memoria_calculo
    legal_rows = (
        f'<tr><td style="color:#C0392B;font-weight:600">PIS / COFINS</td><td>CBS — Contribuição sobre Bens e Serviços</td><td style="font-size:10px;color:#1A6B3C">Substituído</td><td style="font-size:10px">Lei 9.718/98 → LC 214/2025</td></tr>'
        f'<tr><td style="color:#C0392B;font-weight:600">ISS</td><td>IBS — Imposto sobre Bens e Serviços</td><td style="font-size:10px;color:#1A6B3C">Substituído</td><td style="font-size:10px">LC 116/2003 → LC 214/2025</td></tr>'
        f'<tr><td style="color:#334E6E;font-weight:500">IRPJ / CSLL</td><td>Mantido — incide sobre o lucro</td><td style="font-size:10px;color:#9BA8C2">Vigente</td><td style="font-size:10px">Lei 9.249/95 / Lei 7.689/88</td></tr>'
        f'<tr><td style="color:#334E6E;font-weight:500">IBS</td><td>Alíquota provisória: {_pct((mc.ibs_percentual * 100) if mc else 19.2)}</td><td style="font-size:10px;color:#E8A838">Provisória</td><td style="font-size:10px">Comitê Gestor / Senado</td></tr>'
        f'<tr><td style="color:#334E6E;font-weight:500">CBS</td><td>Alíquota provisória: {_pct((mc.cbs_percentual * 100) if mc else 8.8)}</td><td style="font-size:10px;color:#E8A838">Provisória</td><td style="font-size:10px">Resolução Senado Federal</td></tr>'
    )

    profile_items = [
        ("Empresa", _esc(empresa)),
        ("Regime tributário", _esc(REGIME_LABEL.get(r.regime, r.regime))),
        ("Setor", _esc(r.setor_nome)),
        ("UF", _esc(r.uf)),
        ("Base da operação", _br(r.valor_operacao)),
        ("Ano de referência", str(r.ano)),
    ]
    if mc:
        if mc.faturamento_mensal:
            profile_items.append(("Faturamento mensal", _br(mc.faturamento_mensal)))
        if mc.despesas_mensais:
            profile_items.append(("Despesas mensais", _br(mc.despesas_mensais)))
        profile_items.append(("Crédito de entrada", _pct(mc.percentual_credito_entrada * 100)))
        profile_items.append(("Redução setorial", _pct(mc.reducao_setor * 100)))

    profile_rows = "".join(
        f'<tr><td style="color:#9BA8C2">{lbl}</td><td style="font-weight:600;color:#0A2540">{val}</td></tr>'
        for lbl, val in profile_items
    )

    body = (
        _sec("6", "Base Legal e Perfil Financeiro") +
        f'<div>'
        f'<div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:6px">Base Legal — Tributos da Reforma</div>'
        f'<table style="width:100%;border-collapse:collapse">'
        f'<thead><tr>'
        f'<th style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:7px 10px;border-bottom:2px solid #DCE3EF;text-align:left;width:130px">Tributo</th>'
        f'<th style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:7px 10px;border-bottom:2px solid #DCE3EF;text-align:left">Descrição</th>'
        f'<th style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:7px 10px;border-bottom:2px solid #DCE3EF;text-align:left;width:90px">Status</th>'
        f'<th style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:7px 10px;border-bottom:2px solid #DCE3EF;text-align:left">Norma</th>'
        f'</tr></thead>'
        f'<tbody style="font-size:11px">{legal_rows}</tbody></table></div>' +
        f'<div>'
        f'<div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:6px">Perfil da Simulação</div>'
        f'<table style="width:100%;border-collapse:collapse">'
        f'<tbody style="font-size:11px">{profile_rows}</tbody></table></div>'
    )
    return _wrap(body, 6, empresa)


def _p7_dre(empresa: str, r: SimulacaoComProjecaoOutput) -> str:
    val = r.valor_operacao
    mc = r.memoria_calculo
    desp = mc.despesas_mensais if mc and mc.despesas_mensais else val * 0.6

    # Current DRE
    tributos_sobre_receita_atual = sum(
        d.valor for d in r.sistema_atual.detalhes
        if d.nome not in ("IRPJ", "CSLL", "IRPJ adicional", "IRPJ (base lucro)", "CSLL (base lucro)")
        and "IRPJ" not in d.nome and "CSLL" not in d.nome and "adicional" not in d.nome.lower()
    )
    irpjcsll_atual = r.sistema_atual.total - tributos_sobre_receita_atual
    receita_liq_atual = val - tributos_sobre_receita_atual
    lajir_atual = receita_liq_atual - desp
    resultado_atual = lajir_atual - irpjcsll_atual

    tributos_sobre_receita_novo = sum(
        d.valor for d in r.sistema_novo.detalhes
        if "CBS" in d.nome or "IBS" in d.nome or "PIS" in d.nome or "COFINS" in d.nome or "ISS" in d.nome or "ICMS" in d.nome or "DAS" in d.nome
    )
    irpjcsll_novo = r.sistema_novo.total - tributos_sobre_receita_novo
    receita_liq_novo = val - tributos_sobre_receita_novo
    lajir_novo = receita_liq_novo - desp
    resultado_novo = lajir_novo - irpjcsll_novo

    def _drow(label: str, v1: float, v2: float, style: str = "", bold: bool = False) -> str:
        wt = "font-weight:700;" if bold else ""
        sign1 = "−" if v1 < 0 else ""
        sign2 = "−" if v2 < 0 else ""
        diff = v2 - v1
        diff_cor = "#1A6B3C" if diff > 0 else "#C0392B" if diff < 0 else "#9BA8C2"
        return (
            f'<tr style="border-bottom:1px solid #F0F3F8;{style}">'
            f'<td style="font-size:10px;padding:7px 0;color:#3D4559;{wt}">{_esc(label)}</td>'
            f'<td style="font-size:10px;padding:7px 10px;text-align:right;{wt};font-variant-numeric:tabular-nums">{sign1}{_n(abs(v1))}</td>'
            f'<td style="font-size:10px;padding:7px 10px;text-align:right;{wt};font-variant-numeric:tabular-nums">{sign2}{_n(abs(v2))}</td>'
            f'<td style="font-size:10px;padding:7px 0;text-align:right;font-weight:600;color:{diff_cor};font-variant-numeric:tabular-nums">{"+" if diff > 0 else ""}{_n(diff)}</td>'
            f'</tr>'
        )

    rows = (
        _drow("Receita Bruta", val, val) +
        _drow("(−) Tributos sobre Receita", -tributos_sobre_receita_atual, -tributos_sobre_receita_novo) +
        _drow("(=) Receita Líquida", receita_liq_atual, receita_liq_novo, bold=True) +
        _drow("(−) Despesas Operacionais", -desp, -desp) +
        _drow("(=) LAJIR", lajir_atual, lajir_novo, bold=True) +
        _drow("(−) IRPJ / CSLL", -irpjcsll_atual, -irpjcsll_novo) +
        _drow("(=) Resultado Líquido", resultado_atual, resultado_novo, style="border-bottom:2px solid #0A2540", bold=True)
    )

    table = (
        f'<table style="width:100%;border-collapse:collapse">'
        f'<thead><tr>'
        f'<th style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:7px 0;border-bottom:2px solid #DCE3EF;text-align:left">Item</th>'
        f'<th style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:7px 10px;border-bottom:2px solid #DCE3EF;text-align:right;width:140px">Sistema Atual (R$)</th>'
        f'<th style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:7px 10px;border-bottom:2px solid #DCE3EF;text-align:right;width:140px">Sistema Novo (R$)</th>'
        f'<th style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:7px 0;border-bottom:2px solid #DCE3EF;text-align:right;width:100px">Variação</th>'
        f'</tr></thead>'
        f'<tbody>{rows}</tbody></table>'
    )

    note = (
        f'<div style="background:#F5F7FC;border-radius:8px;padding:10px 14px;border:1px solid #DCE3EF">'
        f'<div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#334E6E;margin-bottom:3px">Nota metodológica</div>'
        f'<div style="font-size:9px;color:#6B7592;line-height:1.6">'
        f'Despesas operacionais estimadas em {_br(desp)} {"(informado)" if mc and mc.despesas_mensais else "(estimativa 60% da receita)"}. '
        f'IRPJ/CSLL calculados sobre o lucro efetivo (Lucro Real) ou sobre base presumida. '
        f'Resultado para fins de planejamento tributário; não substitui demonstração contábil oficial.</div></div>'
    )

    body = _sec("7", "DRE — Impacto da Reforma Tributária", f"Regime: {REGIME_LABEL.get(r.regime, r.regime)} · Base: {_br(r.valor_operacao)}") + table + note
    return _wrap(body, 7, empresa)


def _p8_analise(empresa: str, r: SimulacaoComProjecaoOutput, comparativo: dict) -> str:
    regimes_order = ["lucro_real", "lucro_presumido", "simples_nacional"]
    all_results = {r.regime: r}
    all_results.update(comparativo)

    sections = ""
    for rg in regimes_order:
        if rg not in all_results:
            continue
        res = all_results[rg]
        cor = REGIME_COLOR.get(rg, "#334E6E")
        lbl = REGIME_LABEL.get(rg, rg)
        is_this = rg == r.regime
        highlight_bg = "#F9FAFB" if is_this else ""
        this_note = ' <span style="font-size:9px;color:#9BA8C2">(regime simulado)</span>' if is_this else ""

        rows_atual = ""
        for d in res.sistema_atual.detalhes:
            rows_atual += (
                f'<tr><td style="color:#6B7592;font-size:10px;padding:5px 8px;border-bottom:1px solid #F0F3F8">{_esc(d.nome)}</td>'
                f'<td style="text-align:right;font-size:10px;padding:5px 8px;border-bottom:1px solid #F0F3F8;font-variant-numeric:tabular-nums">{_pct(d.aliquota_aplicada)}</td>'
                f'<td style="text-align:right;font-size:10px;padding:5px 8px;border-bottom:1px solid #F0F3F8;font-variant-numeric:tabular-nums">{_n(d.valor)}</td>'
                f'<td style="text-align:right;font-size:10px;padding:5px 8px;border-bottom:1px solid #F0F3F8;font-variant-numeric:tabular-nums">{_pct(d.aliquota_aplicada)}</td></tr>'
            )
        rows_atual += (
            f'<tr style="font-weight:700;background:#F5F7FC">'
            f'<td style="font-size:10px;padding:5px 8px;color:#0A2540">Total atual</td>'
            f'<td></td>'
            f'<td style="text-align:right;font-size:10px;padding:5px 8px;color:{cor};font-variant-numeric:tabular-nums">{_n(res.sistema_atual.total)}</td>'
            f'<td style="text-align:right;font-size:10px;padding:5px 8px;color:{cor};font-variant-numeric:tabular-nums">{_pct(res.sistema_atual.percentual_sobre_valor)}</td></tr>'
        )

        rows_novo = ""
        for d in res.sistema_novo.detalhes:
            rows_novo += (
                f'<tr><td style="color:#6B7592;font-size:10px;padding:5px 8px;border-bottom:1px solid #F0F3F8">{_esc(d.nome)}</td>'
                f'<td style="text-align:right;font-size:10px;padding:5px 8px;border-bottom:1px solid #F0F3F8;font-variant-numeric:tabular-nums">{_pct(d.aliquota_aplicada)}</td>'
                f'<td style="text-align:right;font-size:10px;padding:5px 8px;border-bottom:1px solid #F0F3F8;font-variant-numeric:tabular-nums">{_n(d.valor)}</td>'
                f'<td style="text-align:right;font-size:10px;padding:5px 8px;border-bottom:1px solid #F0F3F8;font-variant-numeric:tabular-nums">{_pct(d.aliquota_aplicada)}</td></tr>'
            )
        rows_novo += (
            f'<tr style="font-weight:700;background:#F5F7FC">'
            f'<td style="font-size:10px;padding:5px 8px;color:#0A2540">Total novo</td>'
            f'<td></td>'
            f'<td style="text-align:right;font-size:10px;padding:5px 8px;color:{cor};font-variant-numeric:tabular-nums">{_n(res.sistema_novo.total)}</td>'
            f'<td style="text-align:right;font-size:10px;padding:5px 8px;color:{cor};font-variant-numeric:tabular-nums">{_pct(res.sistema_novo.percentual_sobre_valor)}</td></tr>'
        )

        col_hdr = (
            f'<thead><tr>'
            f'<th style="font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#9BA8C2;padding:5px 8px;border-bottom:1px solid #DCE3EF;text-align:left">Tributo</th>'
            f'<th style="font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#9BA8C2;padding:5px 8px;border-bottom:1px solid #DCE3EF;text-align:right">Alíq.</th>'
            f'<th style="font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#9BA8C2;padding:5px 8px;border-bottom:1px solid #DCE3EF;text-align:right">R$</th>'
            f'<th style="font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#9BA8C2;padding:5px 8px;border-bottom:1px solid #DCE3EF;text-align:right">% fat.</th>'
            f'</tr></thead>'
        )

        sections += (
            f'<div style="border:1px solid #DCE3EF;border-radius:8px;overflow:hidden;border-left:3px solid {cor};background:{highlight_bg}">'
            f'<div style="padding:8px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #DCE3EF">'
            f'<span style="font-size:10px;font-weight:700;color:{cor}">{_esc(lbl)}{this_note}</span>'
            f'<span style="font-size:10px;font-weight:600;color:#0A2540">{_br(res.sistema_novo.total)} no sistema novo ({_pct(res.sistema_novo.percentual_sobre_valor)})</span>'
            f'</div>'
            f'<div style="display:flex">'
            f'<div style="flex:1;border-right:1px solid #F0F3F8">'
            f'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:5px 10px;background:#FAFAFA;border-bottom:1px solid #F0F3F8">Sistema atual</div>'
            f'<table style="width:100%;border-collapse:collapse">{col_hdr}<tbody>{rows_atual}</tbody></table></div>'
            f'<div style="flex:1">'
            f'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#01D1FF;padding:5px 10px;background:#F5FFFE;border-bottom:1px solid #F0F3F8">Sistema novo</div>'
            f'<table style="width:100%;border-collapse:collapse">{col_hdr}<tbody>{rows_novo}</tbody></table></div>'
            f'</div></div>'
        )

    body = _sec("8", "Análise Detalhada por Regime", f"Base de cálculo: {_br(r.valor_operacao)}") + sections
    return _wrap(body, 8, empresa)


def _p9_conclusao(empresa: str, r: SimulacaoComProjecaoOutput, comparativo: dict) -> str:
    all_results = {r.regime: r}
    all_results.update(comparativo)
    all_pcts = {rg: res.sistema_novo.percentual_sobre_valor for rg, res in all_results.items()}
    best = min(all_pcts, key=all_pcts.get)
    best_lbl = REGIME_LABEL.get(best, best)
    best_cor = REGIME_COLOR.get(best, "#1A6B3C")

    is_economy = r.economia_ou_acrescimo < 0
    economia_abs = abs(r.economia_ou_acrescimo)
    economia_pct = abs(r.economia_percentual)

    recommendation = (
        f'<div style="background:#0A2540;border-radius:12px;color:white;margin-bottom:12px;position:relative;overflow:hidden">'
        f'<img src="{_C_SRC}" style="position:absolute;right:24px;top:50%;transform:translateY(-50%);height:240px;width:auto;opacity:0.13;pointer-events:none">'
        f'<div style="padding:20px 24px;position:relative">'
        f'<div style="font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#01D1FF;margin-bottom:8px">RECOMENDAÇÃO</div>'
        f'<div style="font-size:18px;font-weight:800;margin-bottom:8px">{_esc(best_lbl)}</div>'
        f'<div style="font-size:11px;color:#8BA3C2;margin-bottom:12px">Regime com menor carga tributária no sistema novo — {_pct(all_pcts[best])} da operação</div>'
        f'<div style="display:flex;gap:12px">'
        f'<div style="background:rgba(255,255,255,.08);border-radius:8px;padding:12px 16px;flex:1">'
        f'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#8BA3C2;margin-bottom:4px">Carga no sistema atual</div>'
        f'<div style="font-size:16px;font-weight:700;color:white">{_pct(r.sistema_atual.percentual_sobre_valor)}</div></div>'
        f'<div style="background:rgba(255,255,255,.08);border-radius:8px;padding:12px 16px;flex:1">'
        f'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#8BA3C2;margin-bottom:4px">Carga no sistema novo</div>'
        f'<div style="font-size:16px;font-weight:700;color:#01D1FF">{_pct(r.sistema_novo.percentual_sobre_valor)}</div></div>'
        f'<div style="background:rgba(255,255,255,.08);border-radius:8px;padding:12px 16px;flex:1">'
        f'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#8BA3C2;margin-bottom:4px">{"Economia" if is_economy else "Acréscimo"}</div>'
        f'<div style="font-size:16px;font-weight:700;color:{"#4ADE80" if is_economy else "#F87171"}">{"▼" if is_economy else "▲"} {_pct(economia_pct)}</div></div>'
        f'</div></div></div>'
    )

    steps = [
        ("1", "Avalie a migração de regime antes de 2027 (entrada da CBS)."),
        ("2", "Adapte os sistemas de NF-e para destaque de CBS e IBS."),
        ("3", "Implemente controles de crédito CBS/IBS por fornecedor."),
        ("4", "Revise contratos com clientes para repasse da nova carga."),
        ("5", "Consulte o setor contábil para confirmação de alíquotas definitivas (esperadas 2026)."),
    ]
    steps_html = ""
    for n, txt in steps:
        steps_html += (
            f'<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">'
            f'<div style="min-width:22px;height:22px;border-radius:50%;background:#0A2540;display:flex;align-items:center;justify-content:center;flex-shrink:0">'
            f'<span style="font-size:9px;font-weight:700;color:white">{_esc(n)}</span></div>'
            f'<div style="font-size:11px;color:#3D4559;line-height:1.5;padding-top:3px">{_esc(txt)}</div></div>'
        )

    body = (
        _sec("9", "Conclusão e Recomendação") +
        recommendation +
        f'<div>'
        f'<div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:10px">Próximos passos recomendados</div>'
        f'{steps_html}</div>'
    )
    return _wrap(body, 9, empresa)


def _p10_evolucao(empresa: str, r: SimulacaoComProjecaoOutput, comparativo: dict) -> str:
    proj = r.projecao_2026_2033
    if not proj:
        return _wrap(_sec("10", "Evolução da Carga (2026–2033)", "Dados de projeção não disponíveis"), 10, empresa)

    anos = [p.ano for p in proj]

    # Build table rows with per-regime data where available
    all_results = {r.regime: r}
    all_results.update(comparativo)

    regimes_order = ["lucro_real", "lucro_presumido", "simples_nacional"]
    regimes_avail = [rg for rg in regimes_order if rg in all_results]

    # For each regime, get the projeção
    regime_projecoes: dict[str, list] = {}
    for rg, res in all_results.items():
        if hasattr(res, "projecao_2026_2033") and res.projecao_2026_2033:
            regime_projecoes[rg] = res.projecao_2026_2033

    # Header row
    ano_headers = "".join(
        f'<th style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:{"#1A4F9C" if a == r.ano else "#9BA8C2"};padding:7px 8px;border-bottom:2px solid #DCE3EF;text-align:center;{"background:#EDF5FF;" if a == r.ano else ""}">{a}</th>'
        for a in anos
    )
    thead = f'<tr><th style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#9BA8C2;padding:7px 10px;border-bottom:2px solid #DCE3EF;text-align:left;width:150px">Regime</th>{ano_headers}</tr>'

    # Data rows — % table
    tbody_pct = ""
    for rg in regimes_avail:
        cor = REGIME_COLOR.get(rg, "#334E6E")
        lbl = REGIME_LABEL.get(rg, rg)
        proj_data = regime_projecoes.get(rg, [])
        if not proj_data:
            continue
        proj_map = {p.ano: p.percentual_sobre_valor for p in proj_data}
        cells = "".join(
            f'<td style="text-align:center;font-size:10px;padding:8px;font-variant-numeric:tabular-nums;{"background:#EDF5FF;font-weight:700;color:#0A2540;" if a == r.ano else ""}">{_pct(proj_map.get(a, 0))}</td>'
            for a in anos
        )
        is_this = " (simulado)" if rg == r.regime else ""
        tbody_pct += f'<tr style="border-top:2px solid {cor}"><td style="font-size:10px;padding:8px 10px;font-weight:600;color:{cor}">{_esc(lbl)}{_esc(is_this)}</td>{cells}</tr>'

    # Phase cards
    phases = [
        ("#334E6E", "2026", "Sistema atual", "PIS/COFINS/ISS vigentes · preparação para CBS"),
        ("#E8A838", "2027–28", "CBS implantada", "CBS substitui PIS/COFINS · ISS ainda vigente"),
        ("#0A2540", "2029 ★", "Ano de referência", "IBS pleno · CBS + IBS em operação conjunta"),
        ("#17A589", "2030–33", "Transição plena", "Alíquotas CBS/IBS crescem até o sistema pleno"),
    ]
    phase_cards = "".join(
        f'<div style="flex:1;border:1px solid #DCE3EF;border-radius:8px;padding:10px;border-top:3px solid {cor}">'
        f'<div style="font-size:9px;font-weight:700;color:{cor};margin-bottom:3px">{_esc(yr)}</div>'
        f'<div style="font-size:11px;font-weight:600;color:#0A2540;margin-bottom:3px">{_esc(title)}</div>'
        f'<div style="font-size:9px;color:#6B7592;line-height:1.4">{_esc(desc)}</div></div>'
        for cor, yr, title, desc in phases
    )

    body = (
        _sec("10", "Evolução da Carga Tributária — Ano a Ano", "2026–2033 · Coluna destacada = ano de referência") +
        f'<div>'
        f'<div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:6px">Carga tributária como % do faturamento</div>'
        f'<table style="width:100%;border-collapse:collapse"><thead>{thead}</thead><tbody>{tbody_pct}</tbody></table>'
        f'</div>'
        f'<div>'
        f'<div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:8px">Fases da transição tributária</div>'
        f'<div style="display:flex;gap:8px">{phase_cards}</div></div>'
    )
    return _wrap(body, 10, empresa)


def _p11_memoria(empresa: str, r: SimulacaoComProjecaoOutput, comparativo: dict) -> str:
    all_results = {r.regime: r}
    all_results.update(comparativo)
    regimes_order = ["lucro_real", "lucro_presumido", "simples_nacional"]

    sections = ""
    for rg in regimes_order:
        if rg not in all_results:
            continue
        res = all_results[rg]
        cor = REGIME_COLOR.get(rg, "#334E6E")
        lbl = REGIME_LABEL.get(rg, rg)
        is_this = rg == r.regime

        rows = ""
        for d in res.sistema_atual.detalhes:
            rows += (
                f'<tr><td style="color:#6B7592">{_esc(d.nome)}</td>'
                f'<td class="r">{_pct(d.aliquota_aplicada)}</td>'
                f'<td class="r">{_n(d.valor)}</td>'
                f'<td class="r">{_pct(d.valor / res.valor_operacao * 100 if res.valor_operacao else 0)}</td></tr>'
            )
        rows += (
            f'<tr class="tot"><td>Total — {_esc(lbl)}</td><td></td>'
            f'<td class="r">{_n(res.sistema_atual.total)}</td>'
            f'<td class="r">{_pct(res.sistema_atual.percentual_sobre_valor)}</td></tr>'
        )

        this_note = ' <span style="font-size:8px;color:#9BA8C2">(regime simulado)</span>' if is_this else ""
        sections += (
            f'<div>'
            f'<div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:5px;display:flex;align-items:center;gap:8px">'
            f'<div style="width:3px;height:16px;background:{cor};border-radius:2px"></div>'
            f'{_esc(lbl)}{this_note}</div>'
            f'<table style="width:100%;border-collapse:collapse">'
            f'<thead><tr>'
            f'<th style="font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#9BA8C2;padding:5px 10px;border-bottom:1px solid #DCE3EF;text-align:left;width:180px">Tributo</th>'
            f'<th class="r" style="font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#9BA8C2;padding:5px 10px;border-bottom:1px solid #DCE3EF">Alíq.</th>'
            f'<th class="r" style="font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#9BA8C2;padding:5px 10px;border-bottom:1px solid #DCE3EF">R$</th>'
            f'<th class="r" style="font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#9BA8C2;padding:5px 10px;border-bottom:1px solid #DCE3EF">% fat.</th>'
            f'</tr></thead>'
            f'<tbody style="font-size:10px">{rows}</tbody></table></div>'
        )

    body = (
        '<style>tr.tot td{background:#F5F7FC;font-weight:700;color:#0A2540;border-top:1px solid #DCE3EF} td.r{text-align:right;font-variant-numeric:tabular-nums} td{padding:5px 10px;border-bottom:1px solid #F0F3F8}</style>' +
        _sec("11", "Memória de Cálculo — Detalhamento por Tributo") +
        sections
    )
    return _wrap(body, 11, empresa)


def _p12_cronograma(empresa: str) -> str:
    body = (
        _sec("12", "Cronograma da Transição Tributária", "Período 2026–2033 · conforme LC 214/2025") +
        '''<div style="position:relative;padding-left:24px">
  <div style="position:absolute;left:11px;top:12px;bottom:12px;width:2px;background:#DCE3EF;border-radius:1px"></div>

  <div style="position:relative;margin-bottom:14px">
    <div style="position:absolute;left:-18px;top:4px;width:14px;height:14px;border-radius:50%;background:#334E6E;border:2px solid #fff;box-shadow:0 0 0 2px #334E6E"></div>
    <div style="display:flex;gap:12px"><div style="min-width:52px;padding-top:3px;font-size:11px;font-weight:700;color:#334E6E">2026</div>
    <div style="flex:1;border:1px solid #DCE3EF;border-radius:8px;padding:10px 14px">
      <div style="font-size:11px;font-weight:700;color:#0A2540;margin-bottom:3px">Preparação — sistema atual em plena vigência</div>
      <div style="font-size:9px;color:#6B7592;line-height:1.5">PIS/COFINS/ISS/IRPJ/CSLL vigentes · Publicação das regulamentações iniciais da LC 214/2025 · Revisão da estrutura contábil</div>
    </div></div>
  </div>

  <div style="position:relative;margin-bottom:14px">
    <div style="position:absolute;left:-18px;top:4px;width:14px;height:14px;border-radius:50%;background:#E8A838;border:2px solid #fff;box-shadow:0 0 0 2px #E8A838"></div>
    <div style="display:flex;gap:12px"><div style="min-width:52px;padding-top:3px;font-size:11px;font-weight:700;color:#9A6B00">2027</div>
    <div style="flex:1;border:1px solid #F3D88A;border-radius:8px;padding:10px 14px;background:#FFFBF0">
      <div style="font-size:11px;font-weight:700;color:#0A2540;margin-bottom:3px">Entrada da CBS — Substituição do PIS/COFINS</div>
      <div style="font-size:9px;color:#6B7592;line-height:1.5">CBS entra em vigor (substitui PIS/COFINS) · ISS ainda vigente · Split Payment para CBS · Adaptação de NF-e e EFD</div>
    </div></div>
  </div>

  <div style="position:relative;margin-bottom:14px">
    <div style="position:absolute;left:-18px;top:4px;width:14px;height:14px;border-radius:50%;background:#E8A838;border:2px solid #fff;box-shadow:0 0 0 2px #E8A838"></div>
    <div style="display:flex;gap:12px"><div style="min-width:52px;padding-top:3px;font-size:11px;font-weight:700;color:#9A6B00">2028</div>
    <div style="flex:1;border:1px solid #F3D88A;border-radius:8px;padding:10px 14px;background:#FFFBF0">
      <div style="font-size:11px;font-weight:700;color:#0A2540;margin-bottom:3px">Consolidação da CBS + testes do IBS</div>
      <div style="font-size:9px;color:#6B7592;line-height:1.5">CBS em operação plena (8,8% provisório) · Período de testes e convivência para o IBS · Alíquotas definitivas pelo Comitê Gestor</div>
    </div></div>
  </div>

  <div style="position:relative;margin-bottom:14px">
    <div style="position:absolute;left:-18px;top:4px;width:14px;height:14px;border-radius:50%;background:#0A2540;border:2px solid #fff;box-shadow:0 0 0 2px #0A2540"></div>
    <div style="display:flex;gap:12px"><div style="min-width:52px;padding-top:3px;font-size:11px;font-weight:700;color:#0A2540">2029 ★</div>
    <div style="flex:1;border:1px solid #B6D0EE;border-radius:8px;padding:10px 14px;background:#EEF5FF">
      <div style="font-size:11px;font-weight:700;color:#0A2540;margin-bottom:3px">Entrada plena do IBS — Substituição do ISS</div>
      <div style="font-size:9px;color:#3D5A8A;line-height:1.5">IBS pleno (19,2% provisório) · ISS extinto · CBS + IBS em operação conjunta · Split Payment completo · <strong>Ano de referência deste estudo</strong></div>
    </div></div>
  </div>

  <div style="position:relative">
    <div style="position:absolute;left:-18px;top:4px;width:14px;height:14px;border-radius:50%;background:#17A589;border:2px solid #fff;box-shadow:0 0 0 2px #17A589"></div>
    <div style="display:flex;gap:12px"><div style="min-width:52px;padding-top:3px;font-size:11px;font-weight:700;color:#17A589">2030–33</div>
    <div style="flex:1;border:1px solid #B6E0C8;border-radius:8px;padding:10px 14px;background:#EDF7F2">
      <div style="font-size:11px;font-weight:700;color:#0A2540;margin-bottom:3px">Transição plena — sistema dual em vigor</div>
      <div style="font-size:9px;color:#2E7D52;line-height:1.5">Alíquotas CBS/IBS crescem gradativamente · Em 2033: sistema tributário completamente reformulado (IVA-dual)</div>
    </div></div>
  </div>
</div>'''
    )
    return _wrap(body, 12, empresa)


def _p13_reforma(empresa: str) -> str:
    body = (
        _sec("13", "O que Muda com a Reforma Tributária") +
        f'''<div>
  <div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:7px">Tributos Substituídos e Novos Tributos</div>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:7px 10px;border-bottom:2px solid #DCE3EF;text-align:left;width:180px">Tributo Atual</th>
      <th style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:7px 10px;border-bottom:2px solid #DCE3EF;text-align:left">Substituto (Novo Sistema)</th>
      <th style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#9BA8C2;padding:7px 10px;border-bottom:2px solid #DCE3EF;text-align:left;width:120px">Vigência</th>
    </tr></thead>
    <tbody style="font-size:11px">
      <tr><td style="padding:8px 10px;border-bottom:1px solid #F0F3F8;color:#C0392B;font-weight:600">PIS</td><td style="padding:8px 10px;border-bottom:1px solid #F0F3F8;color:#1A6B3C">CBS — Contribuição sobre Bens e Serviços (Federal)</td><td style="padding:8px 10px;border-bottom:1px solid #F0F3F8;font-size:10px;color:#9BA8C2">A partir de 2027</td></tr>
      <tr><td style="padding:8px 10px;border-bottom:1px solid #F0F3F8;color:#C0392B;font-weight:600">COFINS</td><td style="padding:8px 10px;border-bottom:1px solid #F0F3F8;color:#1A6B3C">CBS — Contribuição sobre Bens e Serviços (Federal)</td><td style="padding:8px 10px;border-bottom:1px solid #F0F3F8;font-size:10px;color:#9BA8C2">A partir de 2027</td></tr>
      <tr><td style="padding:8px 10px;border-bottom:1px solid #F0F3F8;color:#C0392B;font-weight:600">ISS</td><td style="padding:8px 10px;border-bottom:1px solid #F0F3F8;color:#1A6B3C">IBS — Imposto sobre Bens e Serviços (Estadual/Municipal)</td><td style="padding:8px 10px;border-bottom:1px solid #F0F3F8;font-size:10px;color:#9BA8C2">A partir de 2029</td></tr>
      <tr><td style="padding:8px 10px;color:#334E6E;font-weight:500">IRPJ / CSLL</td><td style="padding:8px 10px;color:#334E6E">Mantido inalterado — incide sobre o lucro</td><td style="padding:8px 10px;font-size:10px;color:#9BA8C2">Sempre vigente</td></tr>
    </tbody>
  </table>
</div>
<div style="display:flex;gap:10px">
  <div style="flex:1;border:1px solid #DCE3EF;border-radius:8px;padding:14px;border-top:3px solid #0A2540">
    <div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:6px">CBS — Federal</div>
    <div style="font-size:10px;color:#6B7592;line-height:1.6"><strong style="color:#0A2540">Alíquota:</strong> 8,8% (provisória)<br><strong style="color:#0A2540">Base:</strong> Operações com bens e serviços<br><strong style="color:#0A2540">Crédito:</strong> Não-cumulativo (aproveitamento pleno)<br><strong style="color:#0A2540">Vigência:</strong> A partir de jan/2027</div>
  </div>
  <div style="flex:1;border:1px solid #DCE3EF;border-radius:8px;padding:14px;border-top:3px solid #17A589">
    <div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:6px">IBS — Estadual/Municipal</div>
    <div style="font-size:10px;color:#6B7592;line-height:1.6"><strong style="color:#0A2540">Alíquota:</strong> 19,2% (provisória)<br><strong style="color:#0A2540">Base:</strong> Operações com bens e serviços<br><strong style="color:#0A2540">Crédito:</strong> Não-cumulativo (aproveitamento pleno)<br><strong style="color:#0A2540">Vigência:</strong> A partir de jan/2029</div>
  </div>
</div>
<div style="border:1px solid #DCE3EF;border-radius:8px;padding:14px">
  <div style="font-size:10px;font-weight:700;color:#0A2540;margin-bottom:6px">Split Payment — Impacto no Fluxo de Caixa</div>
  <div style="font-size:10px;color:#6B7592;line-height:1.65">O <strong style="color:#0A2540">Split Payment</strong> determina que, ao receber um pagamento, o CBS e IBS são <strong style="color:#C0392B">retidos automaticamente pelo sistema bancário</strong> e repassados ao Fisco. <strong style="color:#E8A838">Impacto direto:</strong> Redução imediata do fluxo de caixa disponível · Necessidade de planejamento de capital de giro.</div>
</div>'''
    )
    return _wrap(body, 13, empresa)


def _p14_credito(empresa: str, today: str) -> str:
    body = (
        _sec("14", "Direito a Crédito de CBS e IBS", "O que gera e o que não gera crédito — conforme LC 214/2025") +
        f'''<div style="display:flex;gap:12px">
  <div style="flex:1">
    <div style="font-size:10px;font-weight:700;color:#1A6B3C;margin-bottom:8px">Gera crédito de CBS/IBS</div>
    <div style="border:1px solid #B6E0C8;border-radius:8px;overflow:hidden">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#2E7D52;padding:7px 12px;background:#EDF7F2;border-bottom:1px solid #B6E0C8">Operações que geram crédito</div>
      <div style="font-size:11px;color:#3D4559;line-height:1.5">
        <div style="padding:8px 12px;border-bottom:1px solid #F0F3F8">Aquisição de <strong style="color:#0A2540">insumos tributados</strong> com CBS/IBS</div>
        <div style="padding:8px 12px;border-bottom:1px solid #F0F3F8">Serviços contratados <strong style="color:#0A2540">ligados à atividade-fim</strong></div>
        <div style="padding:8px 12px;border-bottom:1px solid #F0F3F8">Locação de imóveis para uso operacional</div>
        <div style="padding:8px 12px;border-bottom:1px solid #F0F3F8">Equipamentos e tecnologia utilizados na prestação do serviço</div>
        <div style="padding:8px 12px;border-bottom:1px solid #F0F3F8">Software e licenças de uso profissional</div>
        <div style="padding:8px 12px">Telecomunicações ligadas à atividade</div>
      </div>
    </div>
  </div>
  <div style="flex:1">
    <div style="font-size:10px;font-weight:700;color:#C0392B;margin-bottom:8px">Não gera crédito de CBS/IBS</div>
    <div style="border:1px solid #F4B8B8;border-radius:8px;overflow:hidden">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#9B1C1C;padding:7px 12px;background:#FEF0F0;border-bottom:1px solid #F4B8B8">Operações sem direito a crédito</div>
      <div style="font-size:11px;color:#3D4559;line-height:1.5">
        <div style="padding:8px 12px;border-bottom:1px solid #F0F3F8">Folha de pagamento e encargos sociais (CPP)</div>
        <div style="padding:8px 12px;border-bottom:1px solid #F0F3F8">Pró-labore de sócios</div>
        <div style="padding:8px 12px;border-bottom:1px solid #F0F3F8">Despesas <strong style="color:#0A2540">não ligadas à atividade-fim</strong></div>
        <div style="padding:8px 12px;border-bottom:1px solid #F0F3F8">Consumo pessoal dos sócios / administradores</div>
        <div style="padding:8px 12px;border-bottom:1px solid #F0F3F8">Operações imunes ou isentas de CBS/IBS</div>
        <div style="padding:8px 12px">Serviços adquiridos de contribuintes do Simples Nacional</div>
      </div>
    </div>
  </div>
</div>
<div style="border:1px solid #DCE3EF;border-radius:8px;padding:12px 16px">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9BA8C2;margin-bottom:5px">Nota de Responsabilidade</div>
  <div style="font-size:9px;color:#6B7592;line-height:1.65">Este estudo foi elaborado com base na legislação tributária vigente e na LC 214/2025. As alíquotas de CBS (8,8%) e IBS (19,2%) são provisórias e sujeitas a alteração. As projeções são estimativas para fins de planejamento e não constituem garantia de resultado. A decisão sobre alteração de regime deve ser precedida de análise contábil e jurídica específica.</div>
</div>
<div style="display:flex;justify-content:flex-end;margin-top:4px">
  <div style="text-align:right;border-top:1px solid #DCE3EF;padding-top:14px;min-width:260px">
    <div style="font-size:9px;color:#9BA8C2;margin-bottom:2px">Curitiba, {_esc(today)}</div>
    <div style="font-size:11px;font-weight:600;color:#0A2540;margin-top:12px">Departamento de Planejamento Tributário</div>
    <div style="margin-top:4px">{LOGO_DARK}</div>
    <div style="font-size:9px;color:#9BA8C2;margin-top:2px">conflex.com.br · (41) 3277-1313</div>
  </div>
</div>'''
    )
    return _wrap(body, 14, empresa)


# ─── Main entry point ──────────────────────────────────────────────────────

def gerar_html_estudo(
    empresa_nome: str,
    resultado: SimulacaoComProjecaoOutput,
    comparativo: dict,
) -> str:
    today = date.today().strftime("%d de %B de %Y").replace(
        "January", "janeiro").replace("February", "fevereiro").replace("March", "março"
        ).replace("April", "abril").replace("May", "maio").replace("June", "junho"
        ).replace("July", "julho").replace("August", "agosto").replace("September", "setembro"
        ).replace("October", "outubro").replace("November", "novembro").replace("December", "dezembro")

    pages = "\n".join([
        _p1_capa(empresa_nome, resultado, today),
        _p2_sumario(empresa_nome),
        _p3_metricas(empresa_nome, resultado, comparativo),
        _p4_graficos(empresa_nome, resultado, comparativo),
        _p5_comparativo(empresa_nome, resultado, comparativo),
        _p6_base_legal(empresa_nome, resultado),
        _p7_dre(empresa_nome, resultado),
        _p8_analise(empresa_nome, resultado, comparativo),
        _p9_conclusao(empresa_nome, resultado, comparativo),
        _p10_evolucao(empresa_nome, resultado, comparativo),
        _p11_memoria(empresa_nome, resultado, comparativo),
        _p12_cronograma(empresa_nome),
        _p13_reforma(empresa_nome),
        _p14_credito(empresa_nome, today),
    ])

    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Estudo Tributário — {_esc(empresa_nome)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap">
<style>
*{{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
body{{font-family:'Inter',sans-serif;background:#E8ECF5;padding:20px 0}}
.page{{width:794px;min-height:1122px;margin:0 auto 20px;background:white;display:flex;flex-direction:column;overflow:hidden}}
@media print{{
  body{{background:white;padding:0}}
  .page{{margin:0;page-break-before:always;page-break-after:always;min-height:0;height:1122px}}
  .page:first-child{{page-break-before:avoid}}
  .no-print{{display:none!important}}
}}
@page{{size:A4 portrait;margin:0}}
</style>
</head>
<body>
{pages}
<div class="no-print" style="text-align:center;padding:16px 24px;font-size:12px;color:#334E6E;font-family:Inter,sans-serif;background:#EEF5FF;border-radius:10px;width:794px;margin:0 auto 24px;border:1px solid #B6D0EE">
  <strong>Para salvar como PDF com todas as cores:</strong> pressione <kbd style="background:#0A2540;color:white;padding:2px 7px;border-radius:4px;font-size:11px">Ctrl+P</kbd> → em <em>Impressora</em> selecione <em>"Salvar como PDF"</em> → clique em <strong>Mais configurações</strong> → marque <strong>Gráficos de fundo</strong> &nbsp;·&nbsp; conflex.com.br
</div>
</body>
</html>"""
