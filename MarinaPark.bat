@echo off
setlocal
cd /d "%~dp0"

if /I "%~1"=="--background" goto background
if /I "%~1"=="--foreground" goto foreground

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0MarinaPark.ps1" --launcher
exit /b

:background
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0MarinaPark.ps1" %*
exit /b %errorlevel%

:foreground
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0MarinaPark.ps1" --foreground
pause
