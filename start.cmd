@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Установите Node.js 24 LTS с https://nodejs.org/
 pause
 exit /b 1
)
if not exist node_modules (
 call npm ci
 if errorlevel 1 goto fail
)
node scripts/setup.js
if errorlevel 1 goto fail
echo Откройте http://localhost:3000
node --env-file-if-exists=.env src/server.js
:fail
pause
