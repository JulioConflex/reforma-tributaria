from fastapi import APIRouter, HTTPException
from ..models.schemas import SimulacaoInput, SimulacaoComProjecaoOutput, MarkupInput, MarkupOutput
from ..engine.calculadora import simular, calcular_markup
from ..engine.regras import listar_setores, get_cronograma
import json
from pathlib import Path

router = APIRouter(prefix="/api/py", tags=["simulador"])


@router.post("/simular", response_model=SimulacaoComProjecaoOutput)
def simular_tributos(inp: SimulacaoInput):
    try:
        return simular(inp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/markup", response_model=MarkupOutput)
def calcular_markup_endpoint(inp: MarkupInput):
    try:
        return calcular_markup(inp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/setores")
def listar_setores_endpoint():
    return {"setores": listar_setores()}


@router.get("/cronograma")
def cronograma_completo():
    path = Path(__file__).parent.parent.parent / "dados" / "cronograma.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@router.get("/estados")
def listar_estados():
    path = Path(__file__).parent.parent.parent / "dados" / "estados.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@router.get("/health")
def health():
    return {"status": "ok", "sistema": "Reforma Tributária LC 214/2025"}
