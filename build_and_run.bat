@echo off
setlocal

set "REPO_ROOT=%~dp0"
set "VENV_DIR=%REPO_ROOT%.venv"

where uv >nul 2>nul
if errorlevel 1 (
    echo [error] uv not found on PATH. Install it: https://docs.astral.sh/uv/getting-started/installation/
    pause
    exit /b 1
)

echo [1/4] Creating uv virtual environment at %VENV_DIR% ...
uv venv "%VENV_DIR%"
if errorlevel 1 (
    echo [error] Failed to create the virtual environment. See output above.
    pause
    exit /b 1
)

echo [2/4] Installing dependencies with uv ...
uv pip install --python "%VENV_DIR%\Scripts\python.exe" -r "%REPO_ROOT%game\requirements.txt"
if errorlevel 1 (
    echo [error] Failed to install dependencies. See output above.
    pause
    exit /b 1
)

echo [3/4] Backfilling quiz.json for any lesson that doesn't have one yet ...
pushd "%REPO_ROOT%"
"%VENV_DIR%\Scripts\python.exe" scripts\backfill_quizzes.py
if errorlevel 1 (
    echo [error] Quiz backfill failed. See output above.
    popd
    pause
    exit /b 1
)
popd

echo [4/4] Starting the Knowledge Game server in its own window ...
start "Knowledge Game Server" cmd /k "%VENV_DIR%\Scripts\python.exe" -m uvicorn game.app:app --host 127.0.0.1 --port 8010

echo Waiting for the server to come up ...
timeout /t 3 /nobreak >nul

echo Opening http://127.0.0.1:8010 in Chrome ...
start chrome http://127.0.0.1:8010

echo.
echo The server is running in the "Knowledge Game Server" window.
echo Close that window (or press Ctrl+C inside it) to stop the server.
pause

endlocal
