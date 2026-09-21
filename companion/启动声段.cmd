@echo off
where node >nul 2>nul
if errorlevel 1 (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "%~dp0launch.cjs"
) else (
  node "%~dp0launch.cjs"
)
if errorlevel 1 pause
