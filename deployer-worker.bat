@echo off
chcp 65001 >nul
cd /d "%~dp0worker"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\node-v24.16.0-win-x64"
echo ============================================================
echo   Deployer le Worker Strava sur Cloudflare
echo ============================================================
echo.
echo  Connexion Cloudflare deja faite. On deploie puis on pose les secrets.
echo.
pause
echo.
echo  --- ETAPE B : deploiement du Worker ---
echo  Si on demande un sous-domaine workers.dev, tape un nom simple
echo  en minuscules, par exemple  saintilan  puis Entree.
echo.
call npx -y wrangler deploy
echo.
echo  Repere ci-dessus la ligne  https://strava-elan.XXX.workers.dev
echo.
pause
echo.
echo  --- ETAPE C : poser les 4 valeurs ---
echo  Pour chacune : clic droit pour coller la valeur, puis Entree.
echo.
echo  [1 sur 4]  Client ID  (le nombre)
call npx -y wrangler secret put STRAVA_CLIENT_ID
echo.
echo  [2 sur 4]  Client Secret  (la longue chaine)
call npx -y wrangler secret put STRAVA_CLIENT_SECRET
echo.
echo  [3 sur 4]  refresh_token  (le jeton de l'etape 3)
call npx -y wrangler secret put STRAVA_REFRESH_TOKEN
echo.
echo  [4 sur 4]  Cle inventee  par exemple  elan-cle-92xz7
call npx -y wrangler secret put ELAN_SYNC_KEY
echo.
echo  --- ETAPE D : redeploiement final ---
echo.
call npx -y wrangler deploy
echo.
echo ============================================================
echo  TERMINE. URL du Worker affichee juste au-dessus.
echo  Donne a Claude : l'URL + la cle inventee a l'etape 4.
echo ============================================================
pause
