@echo off
echo === n8n Installation for Weaver ===
echo.

cd /d "%~dp0"

if not exist package.json (
    echo Initializing npm project...
    call npm init -y
)

echo Installing n8n...
call npm install n8n

echo.
echo === n8n installed. Run start.bat to launch. ===
pause
