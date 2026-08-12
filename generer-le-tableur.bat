@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\node-v24.16.0-win-x64"
echo.
echo ========================================================
echo   Regeneration de Plan-Semi-Rennes-2026.xlsx
echo ========================================================
echo.
echo  Le tableur est reconstruit a partir du plan de l'app
echo  (src\data\plan.ts) : c'est la meme source que la montre.
echo  Ferme le fichier dans Excel avant de continuer.
echo.
node scripts\gen-xlsx.mjs
echo.
echo ========================================================
echo  Termine. Tu peux fermer cette fenetre.
echo ========================================================
pause
