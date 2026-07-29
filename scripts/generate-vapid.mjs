// Génère la paire de clés VAPID des rappels push (ECDSA P-256), et l'écrit dans `.env`.
//
// VAPID = la façon dont le serveur de push (Google/Mozilla) identifie l'expéditeur. La clé
// PUBLIQUE part dans le bundle de l'app (c'est son rôle : `applicationServerKey`), la clé
// PRIVÉE ne sort jamais du Worker Cloudflare.
//
// Usage : node scripts/generate-vapid.mjs
//
// Idempotent : refuse d'écraser des clés existantes. Régénérer les clés INVALIDE tous les
// abonnements déjà pris (il faudrait réactiver les rappels sur chaque appareil).
import { generateKeyPairSync } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const ENV = '.env'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })

const bufToB64url = (b) => Buffer.from(b).toString('base64url')

// Formats attendus par `deserializeVapidKeys` (web-push-browser), côté Worker :
//   publique → RAW   = point P-256 non compressé 0x04 || X(32) || Y(32), 65 octets
//              (c'est aussi tel quel l'`applicationServerKey` du navigateur)
//   privée   → PKCS8 (et NON le scalaire `d` brut : la lib fait importKey('pkcs8', …))
const rawPublic = bufToB64url(publicKey.export({ format: 'der', type: 'spki' }).subarray(-65))
const rawPrivate = bufToB64url(privateKey.export({ format: 'der', type: 'pkcs8' }))

const current = existsSync(ENV) ? readFileSync(ENV, 'utf8') : ''
if (/^\s*(VITE_VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY)\s*=\s*\S/m.test(current)) {
  console.error(
    'Des clés VAPID existent déjà dans .env — je ne les écrase pas.\n' +
      'Les régénérer invaliderait tous les abonnements push en cours.\n' +
      'Pour repartir de zéro : supprime les deux lignes du .env, puis relance.',
  )
  process.exit(1)
}

const block =
  (current.endsWith('\n') || current === '' ? '' : '\n') +
  '\n# Rappels push — clés VAPID (générées par scripts/generate-vapid.mjs)\n' +
  '# Publique : embarquée dans le bundle, c\'est normal. Privée : à poser en secret sur le Worker,\n' +
  '#   cd worker/notif && npx wrangler secret put VAPID_PRIVATE_KEY\n' +
  `VITE_VAPID_PUBLIC_KEY=${rawPublic}\n` +
  `VAPID_PRIVATE_KEY=${rawPrivate}\n`

writeFileSync(ENV, current + block)

console.log('Clés VAPID écrites dans .env (gitignoré).\n')
console.log('Clé publique (non secrète) :')
console.log('  ' + rawPublic + '\n')
console.log('La clé privée est dans .env — elle n\'est PAS affichée ici.')
console.log('Prochaine étape :  cd worker/notif && npx wrangler secret put VAPID_PRIVATE_KEY')
