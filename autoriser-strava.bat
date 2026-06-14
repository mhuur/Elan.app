@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\node-v24.16.0-win-x64"
echo.
echo ========================================================
echo   Autoriser Strava pour Elan (une seule fois)
echo ========================================================
echo.
echo  Prepare ton Client ID et Client Secret depuis :
echo    https://www.strava.com/settings/api
echo  (Authorization Callback Domain = localhost)
echo.
node scripts\strava-auth.mjs
echo.
echo ========================================================
echo  Copie le refresh_token affiche ci-dessus dans le Worker.
echo ========================================================
pause
