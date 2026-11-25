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
    input_data: SimulacaoInput


@router.post("/gerar-estudo")
def gerar_estudo(req: GerarEstudoRequest):
    try:
        resultado = simular(req.input_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    comparativo: dict = {}
    regimes = ["lucro_real", "lucro_presumido", "simples_nacional"]
    for r in regimes:
        if r == req.input_data.regime:
            continue
        try:
            alt_data = req.input_data.model_copy(update={"regime": RegimeTributario(r)})
            comparativo[r] = simular(alt_data)
        except Exception:
            pass

    html = gerar_html_estudo(req.empresa_nome, resultado, comparativo)

    safe = req.empresa_nome.replace(" ", "_").replace("/", "-").replace("\\", "-")[:40]
    return Response(
        content=html.encode("utf-8"),
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="estudo-{safe}.html"'},
    )
