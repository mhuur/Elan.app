// Pousse le plan semi (src/data/plan.ts) vers intervals.icu en séances planifiées structurées.
// intervals.icu synchronise ensuite la semaine à venir vers COROS (montre).
//
// Sécurité : la clé API est lue dans l'environnement, jamais écrite ni loguée en entier.
//   $env:INTERVALS_API_KEY  = ta clé (Developer Settings)
//   $env:INTERVALS_ATHLETE_ID = ton athlete id (ex. i123456)
//
// Usage :
//   node scripts/push-to-intervals.mjs                 → DRY-RUN, tout le plan (aucun envoi)
//   node scripts/push-to-intervals.mjs --week 5        → DRY-RUN, seulement la semaine 5
//   node scripts/push-to-intervals.mjs --week 5 --push → ENVOIE la semaine 5
//   node scripts/push-to-intervals.mjs --push          → ENVOIE tout le plan
//   ... --push --clear                                 → efface d'abord nos séances déjà envoyées (re-run propre)
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'

// Charge le plan (TypeScript) via Vite pour garder une source unique avec l'app
const root = fileURLToPath(new URL('..', import.meta.url))
const vite = await createServer({
  root,
  configFile: false,
  logLevel: 'silent',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
})
const { PLAN_SEMI, seanceDateStr, workoutStats, isRepeat } = await vite.ssrLoadModule('/src/data/plan.ts')
await vite.close()

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const valOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined }
const PUSH = has('--push')
const CLEAR = has('--clear')
const onlyWeek = valOf('--week') ? Number(valOf('--week')) : undefined

const API = 'https://intervals.icu/api/v1'
// Identifiants : variables d'environnement OU demandés à l'écran au moment de l'envoi
let KEY = process.env.INTERVALS_API_KEY
let ATHLETE = process.env.INTERVALS_ATHLETE_ID
let auth = null

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim()
}

// ---- Conversion d'une séance Élan → texte d'entraînement intervals.icu ----
const fmtDur = (sec) => {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60), s = sec % 60
  return s ? `${m}m${s}` : `${m}m`
}
const fmtDist = (m) => {
  const km = m / 1000
  return `${Number.isInteger(km) ? km : km.toFixed(1)}km`
}
const target = (step) => {
  if (!step.pace) return 'Z1 Pace' // récup libre : allure facile
  return step.pace.to ? `${step.pace.from}-${step.pace.to}/km` : `${step.pace.from}/km`
}
const stepLine = (step) => `- ${step.distanceM ? fmtDist(step.distanceM) : fmtDur(step.durationSec ?? 0)} ${target(step)}`

function describe(workout) {
  const blocks = []
  for (const part of workout.parts) {
    if (isRepeat(part)) {
      blocks.push([`${part.repeat}x`, ...part.steps.map(stepLine)].join('\n'))
    } else if (part.kind === 'warmup') {
      blocks.push(['Warmup', stepLine(part)].join('\n'))
    } else if (part.kind === 'cooldown') {
      blocks.push(['Cooldown', stepLine(part)].join('\n'))
    } else {
      blocks.push(stepLine(part))
    }
  }
  return blocks.join('\n\n')
}

// Toutes les séances de course du plan (filtrées par semaine si --week)
const events = []
PLAN_SEMI.weeks.forEach((week, wi) => {
  if (onlyWeek && wi + 1 !== onlyWeek) return
  for (const s of week.seances) {
    const date = seanceDateStr(week, s)
    events.push({
      category: 'WORKOUT',
      start_date_local: `${date}T00:00:00`,
      type: 'Run',
      name: s.title,
      moving_time: Math.round(workoutStats(s.workout).sec),
      description: describe(s.workout),
      external_id: `elan-${date}`,
    })
  }
})

// ---- Appels API ----
async function api(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { Authorization: auth, 'Content-Type': 'application/json', ...(opts.headers || {}) } })
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function clearOurs() {
  const oldest = PLAN_SEMI.weeks[0].start
  const last = PLAN_SEMI.weeks[PLAN_SEMI.weeks.length - 1]
  const newest = seanceDateStr(last, last.seances[last.seances.length - 1])
  const existing = await api(`/athlete/${ATHLETE}/events?oldest=${oldest}&newest=${newest}&category=WORKOUT`)
  const ours = existing.filter((e) => (e.external_id ?? '').startsWith('elan-'))
  for (const e of ours) await api(`/athlete/${ATHLETE}/events/${e.id}`, { method: 'DELETE' })
  console.log(`Nettoyage : ${ours.length} séance(s) Élan existante(s) supprimée(s).`)
}

// ---- Exécution ----
console.log(`${events.length} séance(s)${onlyWeek ? ` (semaine ${onlyWeek})` : ''} ${PUSH ? 'À ENVOYER' : 'en DRY-RUN (aucun envoi)'}\n`)
for (const e of events) {
  console.log(`📅 ${e.start_date_local.slice(0, 10)} — ${e.name}  [${Math.round(e.moving_time / 60)} min]`)
  console.log(e.description.split('\n').map((l) => '   ' + l).join('\n'))
  console.log('')
}

if (PUSH) {
  if (!KEY) KEY = await ask('🔑 Colle ta clé API intervals.icu puis Entrée : ')
  if (!ATHLETE) ATHLETE = await ask('🏃 Ton Athlete ID (ex. i123456) puis Entrée : ')
  if (!KEY || !ATHLETE) {
    console.error('❌ Clé API ou Athlete ID manquant.')
    process.exit(1)
  }
  auth = 'Basic ' + Buffer.from('API_KEY:' + KEY).toString('base64')
  console.log('')
  if (CLEAR) await clearOurs()
  let ok = 0
  for (const e of events) {
    try {
      await api(`/athlete/${ATHLETE}/events`, { method: 'POST', body: JSON.stringify(e) })
      ok++
      console.log(`✅ ${e.start_date_local.slice(0, 10)} ${e.name}`)
    } catch (err) {
      console.error(`❌ ${e.name} : ${err.message}`)
    }
  }
  console.log(`\n${ok}/${events.length} séance(s) envoyée(s) sur intervals.icu.`)
} else {
  console.log('— DRY-RUN terminé. Ajoute --push pour envoyer (avec INTERVALS_API_KEY + INTERVALS_ATHLETE_ID).')
}
