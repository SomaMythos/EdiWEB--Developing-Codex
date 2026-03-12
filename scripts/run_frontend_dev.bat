@echo off
setlocal
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
if not defined VITE_API_URL set "VITE_API_URL=/api"
if not defined VITE_BACKEND_URL set "VITE_BACKEND_URL=http://127.0.0.1:8000"
cd /d "%ROOT%\frontend"
npm run dev
