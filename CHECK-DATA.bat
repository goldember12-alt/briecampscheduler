@echo off
title Camp Activity Assignments - Check CSV Data
cd /d "%~dp0"

echo.
echo Checking CSV files in data\import
echo This will NOT modify the database.
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

call npm --prefix app run check:csv
echo.
pause
