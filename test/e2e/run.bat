@echo off
REM One-click Windows batch launcher for OLED E2E Test Suite
py -3 "%~dp0runner.py" %*
exit /b %ERRORLEVEL%
