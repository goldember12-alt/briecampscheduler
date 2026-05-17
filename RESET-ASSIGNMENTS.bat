@echo off
title Camp Activity Assignments - Reset Assignments
cd /d "%~dp0"

echo.
echo WARNING: This clears only camper assignments and counselor staffing assignments.
echo It does NOT delete campers, counselors, users, activities, schedule blocks, offerings, or activity rules.
echo.
set /p CONFIRM=Type RESET to clear assignments: 
if /i not "%CONFIRM%"=="RESET" (
  echo Cancelled. No assignments were changed.
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
  echo Run LOAD-DATA.bat first.
  pause
  exit /b 1
)

call npm --prefix app run reset:assignments
echo.
pause
