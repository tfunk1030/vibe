@echo off
REM Vibe UI Pipeline Launcher
REM Usage: run-ui-pipeline.bat [max_iterations]

setlocal
set MAX_ITERATIONS=%1
if "%MAX_ITERATIONS%"=="" set MAX_ITERATIONS=50

echo.
echo ========================================
echo  Vibe (Pips Solver) UI Pipeline
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0ralph-ui-pipeline.ps1" -MaxIterations %MAX_ITERATIONS%

pause
