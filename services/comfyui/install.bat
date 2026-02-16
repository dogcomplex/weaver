@echo off
echo === ComfyUI Installation for Weaver ===
echo.

cd /d "%~dp0"

if exist ComfyUI (
    echo ComfyUI already cloned. Pulling latest...
    cd ComfyUI && git pull && cd ..
) else (
    echo Cloning ComfyUI...
    git clone https://github.com/comfyanonymous/ComfyUI.git
)

if not exist venv (
    echo Creating Python venv...
    python -m venv venv
)

echo Installing Python dependencies...
call venv\Scripts\activate.bat
pip install -r ComfyUI\requirements.txt
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

echo.
echo === ComfyUI installed. Run start.bat to launch. ===
pause
