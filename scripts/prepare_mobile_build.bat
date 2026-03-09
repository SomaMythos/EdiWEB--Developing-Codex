@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0prepare_mobile_build.ps1" %*
