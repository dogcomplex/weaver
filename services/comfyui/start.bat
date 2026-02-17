@echo off
cd /d "%~dp0"

REM Output goes to the project data/output folder
set "WEAVER_ROOT=%~dp0..\.."
set "OUTPUT_DIR=%WEAVER_ROOT%\data\output"
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Portable version (extracted from .7z)
if exist ComfyUI_windows_portable\run_nvidia_gpu.bat (
    echo Starting ComfyUI portable...
    echo Output directory: %OUTPUT_DIR%
    cd ComfyUI_windows_portable
    .\python_embeded\python.exe -s ComfyUI\main.py --listen 127.0.0.1 --port 4188 --output-directory "%OUTPUT_DIR%" --enable-cors-header "*"
    goto :eof
)

REM Fallback: venv-based install
if exist venv\Scripts\activate.bat (
    echo Starting ComfyUI from venv...
    call venv\Scripts\activate.bat
    python ComfyUI\main.py --listen 127.0.0.1 --port 4188 --output-directory "%OUTPUT_DIR%" --enable-cors-header "*"
    goto :eof
)

echo ERROR: ComfyUI not found. Run install.bat first or extract the portable .7z.
pause
