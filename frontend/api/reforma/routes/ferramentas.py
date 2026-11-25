from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional

from ..engine.ncm_data import buscar_ncm, CATEGORIAS, CAPITULOS, CBS_REFERENCIA, IBS_REFERENCIA
from ..engine.cst_data import CST_CBS_IBS, CCLASS_TRIB

router = APIRouter(prefix="/api/py", tags=["ferramentas"])


# NCM

@router.get("/ncm/{codigo}")
async def consultar_ncm(codigo: str):
    return buscar_ncm(codigo)


@router.get("/ncm")
async def listar_ncm(q: str = Query(default="", description="Busca textual")):
    q_lower = q.lower().strip()
    resultados = []
    for cap, dados in CAPITULOS.items():
        if not q_lower or q_lower in dados["descricao"].lower() or q_lower == cap:
            cat = CATEGORIAS[dados["categoria"]]
            cbs_ef = CBS_REFERENCIA * (1 - cat["reducao_pct"])
            ibs_ef = IBS_REFERENCIA * (1 - cat["reducao_pct"])
            resultados.append({
                "capitulo": cap,
                "descricao": dados["descricao"],
                "categoria": dados["categoria"],
                "categoria_nome": cat["nome"],
                "cbs_efetiva": round(cbs_ef * 100, 2),
                "ibs_efetiva": round(ibs_ef * 100, 2),
                "total": round((cbs_ef + ibs_ef) * 100, 2),
                "reducao_pct": cat["reducao_pct"] * 100,
            })
    return {"resultados": resultados[:50]}


# CST

@router.get("/cst")
async def listar_cst():
    return {"cst": CST_CBS_IBS, "cclass_trib": CCLASS_TRIB}


# Simulação de documentos fiscais

class ItemNota(BaseModel):
    descricao: str
    ncm: str
    valor: float
    quantidade: float = 1.0
    unidade: str = "UN"
    cfop: Optional[str] = None


class SimularDocumentoRequest(BaseModel):
    itens: list[ItemNota]
    regime_comprador: str = "lucro_presumido"


@router.post("/documentos/simular")
async def simular_documento(req: SimularDocumentoRequest):
    total_cbs = 0.0
    total_ibs = 0.0
    total_is = 0.0
    total_credito_b2b = 0.0
    itens_resultado = []

    gera_credito_comprador = req.regime_comprador not in ("simples_nacional", "mei")

    for item in req.itens:
        dados_ncm = buscar_ncm(item.ncm)

        if not dados_ncm.get("encontrado"):
            cat_nome = "Integral (NCM não mapeado)"
            cbs_ef_pct = CBS_REFERENCIA * 100
            ibs_ef_pct = IBS_REFERENCIA * 100
            is_pct = 0.0
            cst = "00"
            reducao_pct = 0.0
            gera_credito = True
        else:
            cat_nome = dados_ncm["categoria_nome"]
            cbs_ef_pct = dados_ncm["cbs_efetiva"]
            ibs_ef_pct = dados_ncm["ibs_efetiva"]
            is_pct = dados_ncm["is_aliquota"]
            cst = dados_ncm["cst_sugerido"]
            reducao_pct = dados_ncm["reducao_pct"]
            gera_credito = reducao_pct < 100.0

        cbs_item = item.valor * cbs_ef_pct / 100
        ibs_item = item.valor * ibs_ef_pct / 100
        is_item = item.valor * is_pct / 100
        credito_item = (cbs_item + ibs_item) if (gera_credito and gera_credito_comprador) else 0.0

        total_cbs += cbs_item
        total_ibs += ibs_item
        total_is += is_item
        total_credito_b2b += credito_item

        itens_resultado.append({
            "descricao": item.descricao,
            "ncm": item.ncm,
            "valor": item.valor,
            "categoria": cat_nome,
            "reducao_pct": reducao_pct,
            "cbs": round(cbs_item, 2),
            "ibs": round(ibs_item, 2),
            "is_": round(is_item, 2),
            "total_tributos": round(cbs_item + ibs_item + is_item, 2),
            "credito_comprador": round(credito_item, 2),
            "cst": cst,
            "gera_credito": gera_credito and gera_credito_comprador,
        })

    valor_total = sum(i.valor for i in req.itens)
    total_tributos = total_cbs + total_ibs + total_is

    return {
        "itens": itens_resultado,
        "totais": {
            "valor_nota": round(valor_total, 2),
            "cbs_total": round(total_cbs, 2),
            "ibs_total": round(total_ibs, 2),
            "is_total": round(total_is, 2),
            "tributos_total": round(total_tributos, 2),
            "carga_pct": round(total_tributos / valor_total * 100, 2) if valor_total else 0,
            "credito_b2b_total": round(total_credito_b2b, 2),
            "credito_b2b_pct": round(total_credito_b2b / valor_total * 100, 2) if valor_total else 0,
        },
        "regime_comprador": req.regime_comprador,
        "observacao": "Alíquotas de referência 2033 — LC 214/2025. Simulação estimada para fins de planejamento.",
    }
