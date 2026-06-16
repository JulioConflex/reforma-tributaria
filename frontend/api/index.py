"""
Entrypoint da função serverless da Vercel — expõe o app FastAPI.

A Vercel detecta `api/index.py` como função Python. Adicionamos a pasta `api/`
ao sys.path para importar o pacote `reforma` (o backend) tanto na Vercel quanto
localmente (uvicorn --app-dir api).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reforma.main import app  # noqa: E402,F401  (importado para a Vercel localizar `app`)
