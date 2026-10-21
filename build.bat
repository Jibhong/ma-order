@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-release.ps1"
if errorlevel 1 (
  echo.
  echo Release failed. Read the message above and fix the reported issue.
  pause
  exit /b 1
)
echo.
echo Release published successfully.
pause
