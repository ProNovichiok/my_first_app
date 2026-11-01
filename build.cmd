@echo off
cd /d "%~dp0"
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 exit /b 1
call npm test
if errorlevel 1 exit /b 1
call npm run build
