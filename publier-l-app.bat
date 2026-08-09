@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\node-v24.16.0-win-x64"
echo ============================================================
echo   Publier Avel en ligne
echo ============================================================
echo.
echo  Reconstruit l'app puis la met en ligne sur les deux adresses :
echo    https://avel.web.app
echo    https://routine-sport-ca440.web.app   (ancienne, PWA deja installees)
echo.
echo  Un commit git NE publie PAS : c'est ce fichier qui met en ligne.
echo.
pause
echo.
echo  --- ETAPE 1 sur 2 : construction ---
echo.
call npm run build
if errorlevel 1 goto erreur
echo.
echo  --- ETAPE 2 sur 2 : mise en ligne ---
echo.
call npx -y firebase-tools deploy --only hosting
if errorlevel 1 goto erreur
echo.
echo ============================================================
echo  PUBLIE.
echo.
echo  Sur l'ordinateur : recharge la page avec Ctrl + Maj + R
echo  Sur le telephone : ferme completement l'app, rouvre-la deux fois
echo    (le service worker sert l'ancienne version au premier lancement)
echo ============================================================
pause
exit /b 0

:erreur
echo.
echo ============================================================
echo  ECHEC. Le message d'erreur est juste au-dessus.
echo  Si c'est une demande de connexion :  npx firebase-tools login
echo ============================================================
pause
exit /b 1
