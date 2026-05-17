@echo off
title Camp Activity Assignments - Load CSV Data
cd /d "%~dp0"

echo.
echo WARNING: This will validate CSV files in data\import and then load setup data.
echo Existing setup data will be replaced.
echo Existing camper and counselor assignments will be cleared.
echo.
set /p CONFIRM=Type YES to continue: 
if /i not "%CONFIRM%"=="YES" (
  echo Cancelled. No data was changed.
  pause
  exit /b 0
)

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

call npm run migrate
if errorlevel 1 goto failed

call npm run check:csv
if errorlevel 1 goto failed

call npm run load:csv
if errorlevel 1 goto failed

echo.
echo Data loaded successfully.
pause
exit /b 0

:failed
echo.
echo Data load failed. Read the error messages above.
pause
exit /b 1
