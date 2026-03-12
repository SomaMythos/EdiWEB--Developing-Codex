@echo off
setlocal
for %%I in ("%~dp0..") do set "ROOT=%%~fI"

set "CLOUDFLARED_BIN=%CLOUDFLARED_BIN%"
if not defined CLOUDFLARED_BIN set "CLOUDFLARED_BIN=C:\cloudflare\cloudflared.exe"
set "CLOUDFLARE_TARGET_URL=%CLOUDFLARE_TARGET_URL%"
if not defined CLOUDFLARE_TARGET_URL set "CLOUDFLARE_TARGET_URL=http://localhost:3000"
set "CLOUDFLARE_CONFIG=%ROOT%\cloudflare\config.yml"

if not exist "%CLOUDFLARED_BIN%" (
  echo [erro] cloudflared.exe nao encontrado em "%CLOUDFLARED_BIN%".
  echo Defina CLOUDFLARED_BIN ou instale o Cloudflare Tunnel nessa pasta.
  exit /b 1
)

echo ========================================
echo  EDI - Cloudflare Tunnel
echo ========================================
echo.

if defined CLOUDFLARE_TUNNEL_TOKEN (
  echo [cloudflare] Iniciando tunnel nomeado via token...
  "%CLOUDFLARED_BIN%" tunnel run --token %CLOUDFLARE_TUNNEL_TOKEN%
  exit /b %errorlevel%
)

if exist "%CLOUDFLARE_CONFIG%" (
  echo [cloudflare] Iniciando tunnel nomeado usando "%CLOUDFLARE_CONFIG%"...
  "%CLOUDFLARED_BIN%" tunnel --config "%CLOUDFLARE_CONFIG%" run
  exit /b %errorlevel%
)

echo [cloudflare] Nenhum token/config encontrado. Abrindo quick tunnel para %CLOUDFLARE_TARGET_URL%...
echo [cloudflare] Copie a URL https://*.trycloudflare.com exibida abaixo para acessar o app externamente.
"%CLOUDFLARED_BIN%" tunnel --url %CLOUDFLARE_TARGET_URL%
