from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes.simulador import router as simulador_router
from .routes.glossario import router as glossario_router
from .routes.recomendacao import router as recomendacao_router
from .routes.assistente import router as assistente_router

app = FastAPI(
    title="Sistema Reforma Tributária – LC 214/2025",
    description=(
        "API para simulação de tributos IBS, CBS e IS conforme "
        "Lei Complementar nº 214, de 16 de janeiro de 2025."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simulador_router)
app.include_router(glossario_router)
app.include_router(recomendacao_router)
app.include_router(assistente_router)


@app.get("/")
def root():
    return {
        "api": "Sistema Reforma Tributária",
        "versao": "1.0.0",
        "lei_base": "LC 214/2025",
        "docs": "/docs",
    }
