@echo off
setlocal
for %%I in ("%~dp0..") do set "ROOT=%%~fI"

echo ========================================
echo  EDI - Local + Cloudflare
echo ========================================
echo.

start "EDI App" "%ROOT%\start_edi.bat"
timeout /t 6 /nobreak > nul
start "EDI Cloudflare" "%ROOT%\scripts\start_cloudflare_tunnel.bat"

echo Backend, frontend e tunnel foram inicializados em janelas separadas.
echo Feche esta janela quando quiser.
