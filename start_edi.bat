@echo off
setlocal
set "ROOT=%~dp0"
set "EDI_CORS_ALLOW_ORIGIN_REGEX=https://.*\.trycloudflare\.com$"
set "VITE_API_URL=/api"
set "VITE_BACKEND_URL=http://127.0.0.1:8000"

echo ========================================
echo  EDI - Life Manager Web
echo  Starting Backend and Frontend...
echo ========================================
echo.

if not exist "%ROOT%frontend\node_modules" (
    echo [setup] frontend\node_modules nao encontrado. Executando npm install...
    pushd "%ROOT%frontend"
    npm install
    popd
)

start "EDI Backend" "%ROOT%scripts\run_backend_dev.bat"

timeout /t 3 /nobreak > nul

start "EDI Frontend" "%ROOT%scripts\run_frontend_dev.bat"

echo.
echo ========================================
echo  EDI is starting!
echo  Backend: http://localhost:8000
echo  Frontend: http://localhost:3000
echo  API Docs: http://localhost:8000/docs
echo ========================================
echo.
echo Press any key to close this window...
pause > nul
