@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_mobile_android_local.ps1" %*
set EXIT_CODE=%ERRORLEVEL%
echo.
if not "%EXIT_CODE%"=="0" (
  echo O launcher falhou com codigo %EXIT_CODE%.
) else (
  echo Launcher finalizado.
)
echo.
pause
exit /b %EXIT_CODE%
