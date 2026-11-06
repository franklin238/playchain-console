@echo off
rem Double-click to open PlayChain Flat. First run installs packages (needs internet, about a minute).
title PlayChain Flat
cd /d "%~dp0web"
where node >/dev/null 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install version 20 or newer from https://nodejs.org and run this again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing packages. First run only, this takes about a minute...
  call npm install
  if errorlevel 1 (
    echo Install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo.
echo PlayChain Flat is starting at http://localhost:5173
echo Your browser opens by itself. Keep this window open while you play; close it to stop.
echo.
call npm run dev -- --open
pause
