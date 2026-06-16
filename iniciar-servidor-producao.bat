@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Sistema Reforma Tributaria - Servidor de PRODUCAO

echo ============================================================
echo    SISTEMA REFORMA TRIBUTARIA  -  MODO PRODUCAO (RAPIDO)
echo ============================================================
echo.

REM --- Descobre o IP desta maquina na rede ---
set "IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
  set "linha=%%a"
  set "IP=!linha: =!"
)
if "%IP%"=="" set "IP=192.168.25.19"

REM --- 1) Backend (FastAPI) escutando em TODA a rede ---
start "Backend - Reforma Tributaria" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

REM --- 2) Compila o frontend (so precisa enquanto o codigo nao muda) ---
echo  Compilando o sistema... (pode levar 1 a 3 minutos na primeira vez)
echo.
cd /d "%~dp0frontend"
call npm run build
if errorlevel 1 (
  echo.
  echo  ====================================================
  echo   ERRO ao compilar. Use o "iniciar-rede-local.bat".
  echo  ====================================================
  pause
  exit /b 1
)

REM --- 3) Sobe o frontend em modo producao, escutando em TODA a rede ---
start "Frontend - Reforma Tributaria" cmd /k "cd /d "%~dp0frontend" && npx next start -H 0.0.0.0 -p 3000"

echo.
echo  ------------------------------------------------------------
echo   NESTE computador (servidor) acesse:
echo       http://localhost:3000
echo.
echo   Nos OUTROS computadores da rede, digite no navegador:
echo       http://%IP%:3000
echo  ------------------------------------------------------------
echo.
echo  Mantenha as DUAS janelas pretas abertas enquanto usar o sistema.
echo.
pause
