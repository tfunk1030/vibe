@echo off
REM Ralph Launcher for Windows
REM Usage: ralph.bat [max_iterations]
REM Default: 10 iterations

set MAX=%1
if "%MAX%"=="" set MAX=10

powershell -ExecutionPolicy Bypass -File "%~dp0ralph-claude.ps1" %MAX%
