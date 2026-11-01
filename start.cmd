@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (echo Install Node.js 24 LTS with npm first.& pause& exit /b 1)
if not exist node_modules call npm ci --omit=dev --ignore-scripts --no-audit --no-fund
if errorlevel 1 exit /b 1
if not exist .env.node node scripts/setup-node.mjs
node --env-file=.env.node server/local.mjs
pause
