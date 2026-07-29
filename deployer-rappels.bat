@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0worker\notif"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\node-v24.16.0-win-x64"

echo ============================================================
echo   Deployer le Worker des RAPPELS de seance sur Cloudflare
echo ============================================================
echo.

rem --- Lit les cles depuis le .env de l'app (jamais committe) ---
set "VAPID_PRIVATE_KEY="
set "NOTIF_KEY="
for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
  if /i "%%A"=="VAPID_PRIVATE_KEY" set "VAPID_PRIVATE_KEY=%%B"
  if /i "%%A"=="VITE_NOTIF_KEY" set "NOTIF_KEY=%%B"
)

if "!VAPID_PRIVATE_KEY!"=="" (
  echo  ERREUR : VAPID_PRIVATE_KEY absente du .env
  echo  Lance d'abord :  node scripts\generate-vapid.mjs
  pause
  exit /b 1
)

echo  --- ETAPE 1 : dependances du Worker ---
call npm install
echo.

echo  --- ETAPE 2 : deploiement ---
echo  Repere la ligne  https://elan-notif.XXX.workers.dev
echo.
call npx -y wrangler deploy
echo.
pause

echo.
echo  --- ETAPE 3 : les secrets (lus automatiquement du .env) ---
echo.
echo  [1 sur 2]  Cle privee VAPID
echo !VAPID_PRIVATE_KEY!| call npx -y wrangler secret put VAPID_PRIVATE_KEY
echo.
if not "!NOTIF_KEY!"=="" (
  echo  [2 sur 2]  Cle partagee anti-abus
  echo !NOTIF_KEY!| call npx -y wrangler secret put ELAN_NOTIF_KEY
) else (
  echo  [2 sur 2]  VITE_NOTIF_KEY absente du .env - on saute, le Worker restera ouvert.
)
echo.

echo ============================================================
echo  TERMINE.
echo.
echo  1. Verifie que VITE_NOTIF_URL du .env correspond a l'URL
echo     affichee a l'etape 2.
echo  2. Redeploie l'app :   npm run build ^&^& npx firebase-tools deploy
echo  3. Sur le telephone : Reglages ^> Activer les rappels,
echo     puis "Envoyer une notification de test".
echo.
echo  Pense a ajouter Avel a l'ecran d'accueil : Chrome desabonne
echo  les sites peu consultes, mais pas les PWA installees.
echo ============================================================
pause
