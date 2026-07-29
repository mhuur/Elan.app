# 💨 Avel — Suivi sport

Application web mobile-first pour planifier vos séances de sport, enregistrer vos performances et suivre vos progrès. Charte « bord de mer » (ardoise & écume, thème sombre), installable sur l'écran d'accueil du téléphone.

## Fonctionnalités

- **Aujourd'hui** : les séances du jour, à compléter en quelques taps. Saisie adaptée à chaque sport :
  - 🚴 Vélo d'appartement : puissance, durée, distance, vitesse moyenne (calculée automatiquement si absente), BPM — prérempli avec la dernière séance.
  - 💪 Muscu au poids du corps : séries × répétitions (ou secondes pour le gainage), préremplies.
  - 🔥 HIIT et 🧘 Étirements : minuteur guidé avec bips, vibrations et écran toujours allumé.
  - 🏃 Running : simple coche (vos perfs restent sur votre app de course).
- **Planning** : semaine type récurrente — ajoutez vos séances aux jours voulus.
- **Exercices** : bibliothèque d'exercices et de séances, entièrement personnalisable, avec liens vidéo YouTube de démo.
- **Progrès** : graphiques d'évolution (séances par semaine, métriques vélo, volume/meilleure série par exercice).
- **Sauvegarde** : export/import JSON depuis les réglages (⚙ en haut de l'écran Aujourd'hui).

L'app démarre avec un jeu d'exercices et de séances par défaut (modifiables et supprimables).

## Démarrage rapide

```bash
npm install
npm run dev
```

Ouvrez http://localhost:5173. Sans configuration Firebase, l'app fonctionne en **mode local** : les données restent dans le navigateur de l'appareil (export/import JSON possible pour sauvegarder ou transférer).

## Activer la synchronisation cloud (Firebase / Firestore)

Vos données vous suivent alors sur tous vos appareils, avec connexion Google. Tout est gratuit (offre « Spark » de Firebase) pour un usage personnel.

### 1. Créer le projet Firebase

1. Allez sur [console.firebase.google.com](https://console.firebase.google.com) et connectez-vous avec votre compte Google.
2. **Créer un projet** → nom : `elan-sport` (ou ce que vous voulez). Google Analytics : inutile, vous pouvez le désactiver.

### 2. Activer la connexion Google

1. Menu **Authentication** → **Get started**.
2. Onglet **Sign-in method** → **Google** → **Activer** → choisissez votre e-mail de support → **Enregistrer**.

### 3. Créer la base de données Firestore

1. Menu **Firestore Database** → **Créer une base de données**.
2. Emplacement : `europe-west1` (Belgique). Mode : **production**.
3. Onglet **Règles** : remplacez le contenu par celui du fichier [firestore.rules](firestore.rules) de ce projet, puis **Publier**. (Chaque utilisateur ne peut lire/écrire que ses propres données.)

### 4. Récupérer la configuration web

1. ⚙ **Paramètres du projet** → section **Vos applications** → icône **`</>`** (Web).
2. Surnom : `elan` → **Enregistrer l'application** (pas besoin de cocher Hosting ici).
3. Copiez les valeurs `firebaseConfig` affichées.

### 5. Configurer l'app

1. Copiez le fichier [.env.example](.env.example) en `.env`.
2. Remplissez chaque ligne avec les valeurs de l'étape 4 :

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=elan-sport.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=elan-sport
VITE_FIREBASE_STORAGE_BUCKET=elan-sport.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
```

3. Relancez `npm run dev` → l'écran de connexion Google apparaît.

💡 Si vous aviez déjà des données en mode local : exportez-les avant (⚙ → Exporter), connectez-vous, puis importez le fichier (⚙ → Importer).

## Mettre l'app en ligne (Firebase Hosting, gratuit)

Pour y accéder depuis votre téléphone partout :

```bash
npm run build
npx firebase-tools login
npx firebase-tools use --add        # sélectionnez votre projet
npx firebase-tools deploy
```

L'URL `https://votre-projet.web.app` est affichée à la fin.

**Important** : après déploiement, autorisez ce domaine pour la connexion Google : console Firebase → **Authentication** → **Settings** → **Authorized domains** → ajoutez `votre-projet.web.app` (souvent déjà présent).

## Installer sur le téléphone (PWA)

1. Ouvrez l'URL de l'app dans Chrome (Android) ou Safari (iPhone).
2. Menu → **Ajouter à l'écran d'accueil**.
3. L'app s'ouvre en plein écran, comme une app native, et fonctionne même hors connexion (les données se synchronisent au retour du réseau).

## Technique

- React 19 + TypeScript + Vite, Tailwind CSS 4, Recharts, Firebase (Auth Google + Firestore avec cache hors-ligne), PWA via vite-plugin-pwa.
- Données : `users/{uid}/exercises|sessions|logs` dans Firestore, ou `localStorage` en mode local (même interface `Store`, voir [src/data/store.ts](src/data/store.ts)).
- Charte « bord de mer » : tous les tokens (couleurs, ombres, police) vivent dans [src/index.css](src/index.css) (`@theme` Tailwind v4). La marque est l'**ogive** : version transparente dans [public/icon.svg](public/icon.svg) pour l'écran, version sur pastille ardoise dans [public/icons/](public/icons/) pour l'écran d'accueil et les favicons.
- `npm run build` : compile dans `dist/`. `node scripts/make-icons.mjs` : régénère les icônes PNG de `public/icons/` (le script compose son propre SVG).
- `npm run dev:demo` : serveur en mode local forcé (port 5174), même si `.env` est configuré — pratique pour tester sans toucher aux vraies données.
- `node scripts/smoke.mjs` : test de fumée Playwright (nécessite `npm run dev:demo` lancé). `node scripts/check-charte.mjs` : captures des écrans que le smoke ne traverse pas (Réglages, Plan, fiche COROS, Objectifs), pour contrôler la charte. `node scripts/check-cloud.mjs` : vérifie l'écran de connexion en mode cloud.
