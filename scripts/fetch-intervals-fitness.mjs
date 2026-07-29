// Lit les données de forme depuis intervals.icu (lecture seule) : réglages seuil du profil Run,
// bien-être quotidien (FC repos, HRV, charge CTL/ATL, VO2max si synchronisé) et activités récentes.
// La clé API n'est jamais affichée ni écrite. Usage : node scripts/fetch-intervals-fitness.mjs
import { loadCreds } from './intervals-creds.mjs'

const { key, athleteId, file } = loadCreds()
if (!key || !athleteId) {
  console.error('Identifiants intervals.icu introuvables (env ou fichier .txt du dossier).')
  process.exit(1)
}
console.error(`Identifiants chargés depuis : ${file ?? 'variables d’environnement'}`)

const auth = 'Basic ' + Buffer.from(`API_KEY:${key}`).toString('base64')
async function get(path) {
  const res = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}${path}`, {
    headers: { Authorization: auth },
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

const OLDEST = '2026-06-01'
const NEWEST = '2026-07-08'

const [athlete, wellness, activities] = await Promise.all([
  get(''),
  get(`/wellness?oldest=${OLDEST}&newest=${NEWEST}`),
  get(`/activities?oldest=${OLDEST}T00:00:00&newest=${NEWEST}T23:59:59`),
])

// Profil : uniquement les réglages utiles (jamais de champs sensibles)
const runSettings = (athlete.sportSettings ?? [])
  .filter((s) => (s.types ?? []).some((t) => /run/i.test(t)))
  .map((s) => ({
    types: s.types,
    threshold_pace_ms: s.threshold_pace,
    lthr: s.lthr,
    max_hr: s.max_hr,
  }))

const paceMinKm = (ms) => (ms ? `${Math.floor(1000 / ms / 60)}:${String(Math.round((1000 / ms) % 60)).padStart(2, '0')}/km` : null)

const well = (wellness ?? [])
  .filter((w) => w.ctl != null || w.restingHR != null || w.hrv != null || w.vo2max != null)
  .map((w) => ({
    date: w.id,
    ctl: w.ctl != null ? Math.round(w.ctl * 10) / 10 : null,
    atl: w.atl != null ? Math.round(w.atl * 10) / 10 : null,
    restingHR: w.restingHR ?? null,
    hrv: w.hrv ?? null,
    vo2max: w.vo2max ?? null,
    weight: w.weight ?? null,
  }))

const acts = (activities ?? []).map((a) => ({
  date: (a.start_date_local ?? '').slice(0, 10),
  name: a.name,
  type: a.type,
  km: a.distance != null ? Math.round(a.distance / 10) / 100 : null,
  movingMin: a.moving_time != null ? Math.round(a.moving_time / 60) : null,
  avgHr: a.average_heartrate ?? null,
  pace: a.type === 'Run' && a.distance ? Math.round(a.moving_time / (a.distance / 1000)) : null,
}))

console.log(JSON.stringify({
  runSettings: runSettings.map((s) => ({ ...s, threshold_pace: paceMinKm(s.threshold_pace_ms) })),
  wellnessDays: well.length,
  wellness: well,
  activityCount: acts.length,
  activities: acts,
}, null, 1))
