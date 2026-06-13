@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\node-v24.16.0-win-x64"
echo.
echo ========================================================
echo   Recuperer mes courses COROS dans Elan
echo ========================================================
echo.
echo  On va te demander ta cle API intervals.icu et ton Athlete ID.
echo.
node scripts\pull-activities.mjs
echo.
echo ========================================================
echo  Termine. Ouvre Elan et valide tes seances.
echo ========================================================
pause
