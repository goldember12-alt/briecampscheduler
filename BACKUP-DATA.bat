@echo off
title Camp Activity Assignments - Backup Data
cd /d "%~dp0"

echo.
echo Creating a timestamped backup of the local SQLite database.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js LTS from https://nodejs.org/ and then try again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Required app packages are not installed.
  echo Run this once in this folder:
  echo.
  echo   npm install
  echo.
  pause
  exit /b 1
)

call npm run backup
echo.
pause
