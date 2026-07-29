# Worker Strava → Avel

Mini-relais qui détient les identifiants Strava et renvoie tes courses récentes au format
Avel. Il existe parce que Strava **bloque le navigateur** sur le rafraîchissement du token
(CORS) : ce relais fait cette étape côté serveur, l'app n'a alors qu'à lire la liste.

## Mise en place (une fois)

### 1. COROS → Strava (dans l'app COROS)
Profil → Réglages → Applications tierces → Synchro des données → **Strava** → autoriser.
Désormais chaque sortie COROS arrive sur Strava « en moins de quelques minutes ».

### 2. Créer une application Strava
- Va sur https://www.strava.com/settings/api
- **Authorization Callback Domain** : `localhost` (pour l'autorisation ci-dessous)
- Note le **Client ID** et le **Client Secret**.

### 3. Obtenir le refresh_token
Depuis le dossier `Sport/` :
```
node scripts/strava-auth.mjs        # ou double-clic sur autoriser-strava.bat
```
Suis les instructions (ouvre l'URL, autorise). Le script affiche le **refresh_token**.

### 4. Déployer le Worker (Cloudflare, gratuit)
- Crée un compte gratuit sur https://dash.cloudflare.com (Workers & Pages).
- Depuis le dossier `worker/` :
```
npx wrangler login
npx wrangler secret put STRAVA_CLIENT_ID
npx wrangler secret put STRAVA_CLIENT_SECRET
npx wrangler secret put STRAVA_REFRESH_TOKEN
npx wrangler secret put ELAN_SYNC_KEY        # invente une chaîne au hasard (optionnel)
npx wrangler deploy
```
Wrangler affiche l'URL publique, ex. `https://strava-elan.<toi>.workers.dev`.

### 5. Brancher Avel
Dans `Sport/.env` (gitignoré) :
```
VITE_STRAVA_SYNC_URL=https://strava-elan.<toi>.workers.dev
VITE_STRAVA_SYNC_KEY=<la même chaîne que ELAN_SYNC_KEY, si tu en as mis une>
```
Puis `npm run build` + déploiement Firebase. Le bouton **« Synchroniser »** apparaît dans Avel
(sélecteur de validation + Réglages).

## Vérifier le Worker
```
curl "https://strava-elan.<toi>.workers.dev?days=30" -H "Authorization: Bearer <ELAN_SYNC_KEY>"
```
Doit renvoyer `{"activities":[…]}`.
