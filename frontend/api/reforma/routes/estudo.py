from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from ..models.schemas import SimulacaoInput, RegimeTributario
from ..engine.calculadora import simular
from ..engine.gerador_estudo import gerar_html_estudo

router = APIRouter(prefix="/api/py", tags=["estudo"])


class GerarEstudoRequest(BaseModel):
    empresa_nome: str
    contador_nome: Optional[str] = None
    contador_crc: Optional[str] = None
    input_data: SimulacaoInput


@router.post("/gerar-estudo")
def gerar_estudo(req: GerarEstudoRequest):
    try:
        resultado = simular(req.input_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    _LIMITE_SIMPLES = 4_800_000.0
    _LIMITE_MEI     = 81_000.0
    fat = req.input_data.faturamento_anual or 0.0

    comparativo: dict = {}
    regimes = ["lucro_real", "lucro_presumido", "simples_nacional", "mei"]
    for r in regimes:
        if r == req.input_data.regime:
            continue
        if r == "simples_nacional" and fat > _LIMITE_SIMPLES:
            continue
        if r == "mei" and fat > _LIMITE_MEI:
            continue
        try:
            alt_data = req.input_data.model_copy(update={"regime": RegimeTributario(r)})
            comparativo[r] = simular(alt_data)
        except Exception:
            pass

    html = gerar_html_estudo(req.empresa_nome, resultado, comparativo,
                              contador_nome=req.contador_nome,
                              contador_crc=req.contador_crc)

    safe = req.empresa_nome.replace(" ", "_").replace("/", "-").replace("\\", "-")[:40]
    return Response(
        content=html.encode("utf-8"),
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="estudo-{safe}.html"'},
    )
