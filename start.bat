@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo First follow the virtual environment setup in README.md.
    pause
    exit /b 1
)
echo Open http://127.0.0.1:8000 in your browser. Press Ctrl+C to stop.
".venv\Scripts\python.exe" run.py
pause
