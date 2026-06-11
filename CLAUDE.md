# Élan — Suivi sport

App PWA mobile-first de suivi sportif (running, vélo d'appartement, muscu, HIIT, étirements). UI en français, design vert sauge/crème.

## Commandes

- `npm run dev` — serveur de dev (http://localhost:5173), mode cloud si `.env` rempli
- `npm run dev:demo` — serveur en mode local forcé (port 5174, `.env.demo` vide les clés Firebase)
- `npm run build` — tsc + vite build vers `dist/`
- `node scripts/smoke.mjs` — test de fumée Playwright (lancer `dev:demo` avant), captures dans `screenshots/`
- `node scripts/check-cloud.mjs` — vérifie l'écran de connexion Google sur 5173
- `node scripts/make-icons.mjs` — régénère les PNG PWA depuis `public/icon.svg`

Le `.env` (gitignoré) contient la config Firebase du projet `routine-sport-ca440` de l'utilisateur.

## Environnement

Node.js est installé en **portable** (pas de droits admin sur cette machine) dans
`%LOCALAPPDATA%\Programs\node-v24.16.0-win-x64`, ajouté au PATH utilisateur.
Si `node` est introuvable dans un shell : `$env:Path += ";$env:LOCALAPPDATA\Programs\node-v24.16.0-win-x64"`.
Ne jamais lancer d'installation nécessitant une élévation UAC (winget MSI, etc.).

## Architecture

- **Double mode de stockage** (`src/data/store.ts`) : interface `Store` avec `LocalStore` (localStorage, par défaut sans `.env`) et `FirestoreStore` (`users/{uid}/exercises|sessions|logs`). Le mode est choisi dans `src/firebase.ts` selon la présence des variables `VITE_FIREBASE_*` dans `.env`.
- `src/data/DataContext.tsx` : provider unique (auth Google + abonnements aux 3 collections + CRUD + seed au premier lancement via `src/data/seed.ts`, gardé par un flag localStorage `elan-seeded-*`).
- Types et métadonnées de catégories (couleurs/emoji/classes Tailwind) : `src/types.ts`.
- Jours de semaine indexés **0 = lundi … 6 = dimanche** (`src/lib/dates.ts`), dates de logs en `YYYY-MM-DD` local.
- Planification : jours fixes (`Session.days`) OU intervalle (`Session.repeat` = tous les X jours + date de départ + alternance optionnelle avec une autre séance). Logique centralisée dans `src/lib/schedule.ts` (`plannedSessionIdsOn`). `repeat: null` (et non undefined) pour désactiver — Firestore ne supprime pas les champs absents d'un update.
- Sémantique par sport : running = simple coche ; vélo = formulaire perfs (préremplies depuis le dernier log) ; muscu = séries×reps (exercices `measure: 'sec'` pour le gainage) ; HIIT/étirements = minuteur guidé `src/pages/Player.tsx` (WebAudio + vibration + wake lock, log auto en fin).
- Tailwind v4 : thème en CSS-first dans `src/index.css` (`@theme`), pas de tailwind.config.

## Pièges connus

- Firestore refuse `undefined` → tout passe par `clean()` dans store.ts ; les champs optionnels vidés sont stockés comme `''`.
- `tsconfig` strict avec `noUnusedLocals` : tout import non utilisé casse le build.
- Le bundle dépasse 500 kB (Firebase + Recharts) : avertissement vite normal.
