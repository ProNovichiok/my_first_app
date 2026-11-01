@echo off
cd /d "%~dp0"
node --env-file=.env.node scripts/telegram-webhook.mjs check
pause
