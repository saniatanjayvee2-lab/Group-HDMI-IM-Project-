@echo off
setlocal
cd /d "%~dp0backend"
if not exist .env (
  echo ERROR: backend\.env is missing.
  echo Copy the .env from your EXISTING working FixTrack backend.
  echo Use PAYMONGO TEST keys, and set FRONTEND_URL=http://localhost:3000.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
node local-server.js
pause
