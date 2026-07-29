# Worker `elan-notif` — rappels de séance

Envoie une notification « Séance du jour — Fractionné 6×800m · Gainage » sur le téléphone, à
l'heure choisie. Rien les jours de repos, rien si la séance est déjà validée.

**Jusqu'à 4 rappels par jour** (matin, midi, soir…). Le premier de la journée annonce (« Séance du
jour »), les suivants relancent (« Pas encore fait »). Un rappel de midi ou du soir se tait de
lui-même si la séance a été validée entre-temps : l'app réécrit l'agenda à la validation, et le
jour en disparaît.

## Pourquoi un serveur ?

Une PWA **ne peut pas** programmer une notification locale à l'avance. L'API qui le permettrait
(Notification Triggers / `showTrigger`) n'a jamais quitté le stade expérimental et Google en a
officiellement arrêté le développement — classée « No longer pursuing », jamais activée dans
aucun navigateur stable. Un `setTimeout` dans un service worker ne survit pas à son éviction.

Le seul mécanisme fiable est donc un **push Web envoyé par un serveur à l'heure voulue**. C'est
ce Worker, réveillé par un Cron Trigger toutes les 5 minutes.

## Le Worker ne calcule jamais le planning

La planification d'Avel est complexe : cycles d'alternance, « tous les X jours », `repeat.onDays`,
plan semi aligné au lundi. Elle vit dans l'app (`src/lib/schedule.ts`, `src/lib/planDay.ts`).
La réimplémenter ici créerait une seconde source de vérité, vouée à diverger — et un jour un
rappel pour la mauvaise séance.

L'app calcule donc un **agenda des 30 prochains jours** (`src/lib/reminderAgenda.ts`) et l'envoie
au Worker, qui se contente de lire `2026-07-10 → ["Fractionné 6×800m", "Gainage"]`.

Conséquence assumée : **l'agenda périme**. Si Avel n'est pas ouverte pendant plus de 30 jours, les
rappels s'arrêtent — et repartent seuls à la réouverture.

## Identité : la clé KV est le SHA-256 de l'endpoint push

Pas de compte, pas de jeton Firebase. L'endpoint d'un abonnement push est une URL longue et non
devinable, et c'est exactement la capacité que protège l'entrée KV : on ne peut donc écraser une
entrée que si l'on détient déjà ce qu'elle protège.

Trois bénéfices : les rappels marchent aussi en mode local (sans compte), chaque appareil a son
entrée (donc son rappel), et le Worker n'a aucune vérification de JWT à faire.

Le `Bearer` (`ELAN_NOTIF_KEY`) n'est qu'un anti-abus léger, comme pour le Worker Strava : la clé
est embarquée dans le bundle de l'app, donc publique.

## Chiffrement

`web-push-browser` (zéro dépendance, WebCrypto) — VAPID signé en ES256 et charge utile chiffrée en
**`aes128gcm`** (RFC 8291).

Deux pièges rencontrés, à ne pas réintroduire :

- Le paquet npm classique `web-push` **ne marche pas** sur Workers, même avec `nodejs_compat` : il
  appelle `crypto.createECDH` et `https.request`, absents du runtime.
- `@pushforge/builder` et `@block65/webcrypto-web-push` codent en dur l'ancien `aesgcm` (draft-04),
  déprécié et jamais supporté par Safari. Seul `web-push-browser` offre `aes128gcm`.
- Dans `sendPushNotification`, l'option `algorithm` est **obligatoire** malgré sa documentation
  (« defaults to AES128GCM ») : sans elle, `createCEKInfo` lève « Invalid algorithm ».

## Installation

```sh
cd worker/notif
npm install
```

### 1. Clés VAPID (une seule fois)

Depuis la racine du projet :

```sh
node scripts/generate-vapid.mjs
```

Le script écrit dans `.env` (gitignoré) :

- `VITE_VAPID_PUBLIC_KEY` — publique (format RAW, 65 octets). Elle part dans le bundle : c'est son
  rôle (`applicationServerKey`).
- `VAPID_PRIVATE_KEY` — privée (format **PKCS8**, pas le scalaire brut). Ne quitte jamais le Worker.

Le script refuse d'écraser des clés existantes : les régénérer **invaliderait tous les abonnements
déjà pris**.

### 2. Espace KV

```sh
npx wrangler kv namespace create REMINDERS
```

Coller l'`id` renvoyé dans `wrangler.toml`.

### 3. Variables et secrets

`wrangler.toml` (`[vars]`, non secrets) : `VAPID_PUBLIC_KEY` (identique à `VITE_VAPID_PUBLIC_KEY`)
et `ADMIN_CONTACT`.

```sh
npx wrangler secret put VAPID_PRIVATE_KEY   # valeur = VAPID_PRIVATE_KEY du .env
npx wrangler secret put ELAN_NOTIF_KEY      # valeur = VITE_NOTIF_KEY du .env (optionnel)
```

### 4. Déploiement

```sh
npx wrangler deploy
```

Puis renseigner `VITE_NOTIF_URL` dans le `.env` de l'app (ex.
`https://elan-notif.saintilan.workers.dev`) et redéployer l'app. Tant que cette variable est vide,
le bloc « Rappels » des Réglages reste masqué — l'app est donc déployable avant le Worker.

## Routes

Toutes en `POST`, avec `Authorization: Bearer <ELAN_NOTIF_KEY>` si le secret est posé.

| Route          | Corps                                    | Effet                          |
| -------------- | ---------------------------------------- | ------------------------------ |
| `/subscribe`   | `{ subscription, hours[], tz, agenda }`  | Crée ou met à jour l'entrée KV |
| `/unsubscribe` | `{ endpoint }`                           | Supprime l'entrée              |
| `/test`        | `{ endpoint }`                           | Envoie un push immédiat        |

`hours` est un tableau de 1 à 4 heures `"HH:MM"`, trié et dédoublonné à l'écriture. L'ancien champ
`hour` (heure unique) reste accepté et normalisé, pour les clients pas encore rechargés.

`/subscribe` préserve le `lastSent` existant : ré-enregistrer l'agenda ne rejoue pas un rappel déjà
parti. Les heures supprimées sont purgées de `lastSent` au passage.

## Cron

`*/5 * * * *`. Pour chaque abonné, le Worker convertit l'instant courant dans **son** fuseau
(`Intl.DateTimeFormat`) : c'est ce qui fait que le passage heure d'été/hiver se gère tout seul,
alors que le cron tourne en UTC.

Il envoie si l'heure locale est dans les 15 minutes suivant une heure cible (tolérance à la gigue
du cron), que cette heure n'a pas déjà été envoyée aujourd'hui, **et** que l'agenda a des séances
pour aujourd'hui.

`lastSent` est un objet **par heure** (`{ "07:30": "2026-07-10" }`) : c'est ce qui permet au rappel
de midi de partir alors que celui du matin est déjà parti. Le titre dépend du **rang** de l'heure
dans la liste triée — rang 0 annonce, au-delà relance. Un rappel unique posé à 19h a donc le rang 0,
et annonce : c'est correct.

Si deux heures sont assez proches pour que leurs fenêtres se chevauchent, le Worker n'envoie que la
plus tardive et marque l'autre comme envoyée — jamais deux notifications d'affilée. L'app interdit
de toute façon de poser deux rappels à moins de 15 minutes l'un de l'autre.

### Ne jamais envoyer de push muet

Chrome impose `userVisibleOnly: true` et exige qu'un push affiche une notification. Un push qui
n'affiche rien fait apparaître « Ce site a été mis à jour en arrière-plan », puis finit par faire
**révoquer l'abonnement**. D'où la règle : pas de séance aujourd'hui → aucun push.

## Budget du plan gratuit

| Ressource        | Consommation                      | Plafond gratuit  |
| ---------------- | --------------------------------- | ---------------- |
| Réveils cron     | 288 / jour                        | 100 000 req/jour |
| Lectures KV      | 288 × nb d'appareils              | 100 000 / jour   |
| Écritures KV     | ~1 par rappel envoyé, + agenda    | **1 000 / jour** |

Les écritures sont la ressource tendue. Deux garde-fous : l'app ne renvoie l'agenda que si son
empreinte a changé (`agendaFingerprint`), et le cron n'écrit qu'au moment d'un envoi.

## Vérification

```sh
node scripts/check-rappels-worker.mjs   # logique horaire (heure d'été/hiver), surface HTTP, cron
node scripts/check-rappels.mjs          # bloc « Rappels » des Réglages (Worker mocké)
```

Le premier tourne sans réseau ni KV réel : KV factice, `fetch` bouchonné, clés VAPID éphémères.

Le seul test qui prouve la chaîne complète reste **« Envoyer une notification de test »** depuis
les Réglages, sur le vrai téléphone.

## Android : installer Avel sur l'écran d'accueil

Ce n'est pas requis pour recevoir les pushs sur Chrome Android (contrairement à iOS), mais depuis
fin 2025 Chrome désabonne d'office les sites peu consultés qui notifient beaucoup — **les PWA
installées en sont exemptées**. Pour une app de rappels, c'est exactement le profil à risque.
