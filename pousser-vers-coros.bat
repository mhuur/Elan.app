@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\node-v24.16.0-win-x64"
echo.
echo ========================================================
echo   Envoi du plan semi vers intervals.icu (puis COROS)
echo ========================================================
echo.
echo  On va te demander 2 choses : ta cle API et ton Athlete ID.
echo  (les deux sont dans intervals.icu : Parametres - Developer Settings)
echo.
node scripts\push-to-intervals.mjs --clear --push
echo.
echo ========================================================
echo  Termine. Tu peux fermer cette fenetre.
echo ========================================================
pause
