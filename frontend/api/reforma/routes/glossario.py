from fastapi import APIRouter, HTTPException
from pathlib import Path
from functools import lru_cache
import json

router = APIRouter(prefix="/api/py", tags=["glossario"])


@lru_cache(maxsize=1)
def _load() -> dict:
    path = Path(__file__).parent.parent.parent / "dados" / "glossario.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@router.get("/glossario")
def listar_glossario():
    return _load()


@router.get("/glossario/{termo}")
def get_termo(termo: str):
    termos = _load().get("termos", {})
    chave = termo.lower().replace("-", "_")
    if chave not in termos:
        raise HTTPException(status_code=404, detail=f"Termo '{termo}' não encontrado no glossário.")
    return termos[chave]
