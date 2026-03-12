@echo off
setlocal
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
if not defined EDI_CORS_ALLOW_ORIGIN_REGEX set "EDI_CORS_ALLOW_ORIGIN_REGEX=https://.*\.trycloudflare\.com$"
cd /d "%ROOT%\backend"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
