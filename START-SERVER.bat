@echo off
title Camp Activity Assignments - Local Server
cd /d "%~dp0"

echo.
echo Starting Camp Activity Assignments.
echo Counselors should use the network URL printed below after startup.
echo Do not close this window during signups.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js LTS from https://nodejs.org/ and then try again.
  pause
  exit /b 1
)

if not exist app\node_modules (
  echo Required app packages are not installed.
  echo Installing them now. This can take a few minutes.
  echo.
  call npm --prefix app install
  if errorlevel 1 (
    echo Package installation failed.
    pause
    exit /b 1
  )
)

if not exist app\package.json (
  echo The app folder is missing package.json.
  echo Make sure this repository was downloaded completely.
  pause
  exit /b 1
)

if not exist app\prisma\dev.db (
  echo The local database was not found.
  echo Run LOAD-DATA.bat first, then start the server again.
  pause
  exit /b 1
)

echo Local computer URL will be:
echo   http://localhost:3001
echo.
echo Network URLs for counselors will be printed by the app below.
echo.

call npm --prefix app run start:local

echo.
echo Server stopped. Counselors can no longer use the app.
pause
