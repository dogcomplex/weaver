@echo off
cd /d "%~dp0"
set N8N_PORT=5678
set N8N_USER_FOLDER=%~dp0.n8n
npx n8n start
