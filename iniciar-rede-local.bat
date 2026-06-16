@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Sistema Reforma Tributaria - Servidor da Rede

echo ============================================================
echo    SISTEMA REFORMA TRIBUTARIA  -  MODO SERVIDOR (REDE LOCAL)
echo ============================================================
echo.

REM --- Descobre o IP desta maquina na rede ---
set "IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
  set "linha=%%a"
  set "IP=!linha: =!"
)
if "%IP%"=="" set "IP=192.168.25.19"

REM --- 1) Backend (FastAPI realocado em frontend/api) escutando em TODA a rede ---
start "Backend - Reforma Tributaria" cmd /k "cd /d "%~dp0frontend" && call "%~dp0backend\venv\Scripts\activate" && python -m uvicorn index:app --app-dir api --host 0.0.0.0 --port 8000"

REM --- 2) Aguarda o backend subir antes do frontend ---
timeout /t 4 /nobreak >nul

REM --- 3) Frontend (Next.js) escutando em TODA a rede ---
start "Frontend - Reforma Tributaria" cmd /k "cd /d "%~dp0frontend" && npx next dev -H 0.0.0.0 -p 3000"

echo  Servidor iniciando... aguarde uns 15 segundos.
echo.
echo  ------------------------------------------------------------
echo   NESTE computador (servidor) acesse:
echo       http://localhost:3000
echo.
echo   Nos OUTROS computadores da rede, digite no navegador:
echo       http://%IP%:3000
echo  ------------------------------------------------------------
echo.
echo  IMPORTANTE: mantenha as DUAS janelas pretas (Backend e Frontend)
echo  abertas enquanto o sistema estiver em uso. Fechar = derruba o servidor.
echo.
pause
