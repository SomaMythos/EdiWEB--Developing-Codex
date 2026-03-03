@echo off
setlocal

echo ========================================
echo  EDI - Life Manager Web
echo  Starting Backend and Frontend...
echo ========================================
echo.

if not exist "frontend\node_modules" (
    echo [setup] frontend\node_modules nao encontrado. Executando npm install...
    call cmd /c "cd frontend && npm install"
)

REM Start backend in new window
start "EDI Backend" cmd /k "cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

REM Wait a bit for backend to start
timeout /t 3 /nobreak > nul

REM Start frontend in new window
start "EDI Frontend" cmd /k "cd frontend && npm run dev"

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
