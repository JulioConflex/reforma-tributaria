@echo off
cd /d "%~dp0frontend"
npx next dev -H 0.0.0.0 -p 3000
pause
