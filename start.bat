@echo off
setlocal

cd /d "%~dp0"

echo Demarrage du backend sur http://localhost:5000...
start "Branchement AEP - Backend" cmd /k "cd /d "%~dp0backend" && npm start"

echo Demarrage du frontend sur http://localhost:5173...
start "Branchement AEP - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --open"

echo.
echo Application en cours de demarrage.
echo Frontend : http://localhost:5173
echo Backend  : http://localhost:5000
pause
