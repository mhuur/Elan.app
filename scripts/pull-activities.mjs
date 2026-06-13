// Récupère tes courses récentes depuis intervals.icu (qui les reçoit de COROS) et les
// écrit dans Firestore (users/{uid}/activities), pour pouvoir valider une séance du plan
// dans Élan en choisissant la vraie sortie.
//
// Auth Firestore : identifiants firebase-tools déjà connectés (comme fetch-logs.mjs).
// Auth intervals.icu : clé API + Athlete ID (env INTERVALS_API_KEY / INTERVALS_ATHLETE_ID,
//   sinon demandés à l'écran). La clé n'est jamais écrite sur disque.
//
// Usage : node scripts/pull-activities.mjs [--days 45]   (ou double-clic recuperer-mes-courses.bat)
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { loadCreds } from './intervals-creds.mjs'

const PROJECT = 'routine-sport-ca440'
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'

const args = process.argv.slice(2)
const daysArg = args.indexOf('--days')
const DAYS = daysArg >= 0 ? Number(args[daysArg + 1]) : 45

const ask = async (q) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const a = await rl.question(q)
  rl.close()
  return a.trim()
}

// ---- intervals.icu ----
// Identifiants : env, sinon fichier (« user + API.txt »…), sinon demandés à l'écran
const creds = loadCreds()
let KEY = creds.key
let ATHLETE = creds.athleteId
if (creds.file) console.log(`Identifiants lus depuis « ${creds.file} »`)
if (!KEY) KEY = await ask('🔑 Colle ta clé API intervals.icu puis Entrée : ')
if (!ATHLETE) ATHLETE = await ask('🏃 Ton Athlete ID (ex. i123456) puis Entrée : ')
const ivAuth = 'Basic ' + Buffer.from('API_KEY:' + KEY).toString('base64')

const isoDay = (d) => d.toISOString().slice(0, 10)
const newest = isoDay(new Date())
const oldest = isoDay(new Date(Date.now() - DAYS * 86_400_000))

console.log(`\nRécupération des courses du ${oldest} au ${newest}…`)
const ivRes = await fetch(`https://intervals.icu/api/v1/athlete/${ATHLETE}/activities?oldest=${oldest}&newest=${newest}`, {
  headers: { Authorization: ivAuth },
})
if (!ivRes.ok) {
  console.error(`❌ intervals.icu : ${ivRes.status} ${await ivRes.text()}`)
  process.exit(1)
}
const raw = await ivRes.json()
const runs = raw
  .filter((a) => (a.type ?? '').includes('Run'))
  .map((a) => {
    const distanceKm = Math.round(((a.distance ?? 0) / 1000) * 100) / 100
    const durationSec = Math.round(a.moving_time ?? a.elapsed_time ?? 0)
    const paceSec = distanceKm > 0 ? Math.round(durationSec / distanceKm) : 0
    const avgHr = Math.round(a.average_heartrate ?? a.icu_hr_avg ?? 0)
    return {
      id: String(a.id),
      date: (a.start_date_local ?? '').slice(0, 10),
      name: a.name || 'Course',
      distanceKm,
      durationSec,
      paceSec,
      avgHr: avgHr || undefined,
      source: 'intervals',
      externalId: String(a.id),
    }
  })
  .filter((a) => a.date)
console.log(`${runs.length} course(s) trouvée(s).`)

// ---- Firestore (token firebase-tools) ----
const cfg = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'))
async function accessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cfg.tokens.refresh_token, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  })
  if (!res.ok) throw new Error(`refresh failed: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}
const token = await accessToken()
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`
const fsApi = async (path, init) => {
  const res = await fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(body)}`)
  return body
}

// uid de l'utilisateur : depuis le chemin d'un document sessions
const q = { structuredQuery: { from: [{ collectionId: 'sessions', allDescendants: true }], limit: 1 } }
const rows = await fsApi(`/documents:runQuery`, { method: 'POST', body: JSON.stringify(q) })
const sample = rows.find((r) => r.document)?.document?.name
const uid = sample?.match(/users\/([^/]+)\//)?.[1]
if (!uid) {
  console.error('❌ Impossible de trouver ton compte (uid) dans Firestore.')
  process.exit(1)
}

// JS → valeur Firestore typée
const fv = (v) =>
  typeof v === 'number'
    ? Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
    : { stringValue: String(v) }

let ok = 0
for (const a of runs) {
  const fields = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, fv(v)]))
  try {
    await fsApi(`/documents/users/${uid}/activities/${a.id}`, { method: 'PATCH', body: JSON.stringify({ fields }) })
    ok++
  } catch (e) {
    console.error(`❌ ${a.date} ${a.name} : ${e.message}`)
  }
}
console.log(`\n✅ ${ok}/${runs.length} course(s) importée(s) dans Élan. Ouvre l'app et valide tes séances.`)
