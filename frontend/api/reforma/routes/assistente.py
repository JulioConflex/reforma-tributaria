from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..engine.assistente import responder

router = APIRouter(prefix="/api/py", tags=["assistente"])


class PerguntaInput(BaseModel):
    pergunta: str = Field(..., min_length=1, max_length=500)


@router.post("/chat")
def chat(inp: PerguntaInput):
    """Assistente offline da reforma: responde a partir do glossário + lei + setores."""
    return responder(inp.pergunta)
