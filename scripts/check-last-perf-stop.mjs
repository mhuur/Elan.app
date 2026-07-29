// Vérifie le récap « Dernière fois » d'une séance muscu/HIIT : il annonce le TOUR du circuit et
// l'EXERCICE où on s'est arrêté (au lieu des 3 premiers exercices suivis de « … »).
// Test de logique pure (pas de navigateur) : charge timeline.ts / format.ts via Vite ssrLoadModule.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const vite = await createServer({
  root,
  configFile: false,
  logLevel: 'silent',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
})
const { stopPoint } = await vite.ssrLoadModule('/src/lib/timeline.ts')
const { lastPerfLine, lastDetailLine } = await vite.ssrLoadModule('/src/lib/format.ts')
await vite.close()

const exercises = [
  { id: 'pompes', name: 'Pompes', category: 'muscu', measure: 'reps', createdAt: 1 },
  { id: 'gainage', name: 'Gainage', category: 'muscu', measure: 'sec', createdAt: 2 },
  { id: 'squats', name: 'Squats', category: 'muscu', measure: 'reps', createdAt: 3 },
  { id: 'fentes', name: 'Fentes', category: 'muscu', measure: 'reps', createdAt: 4 },
]

// Circuit muscu de 3 tours × 4 exercices (2 séries de pompes) = 15 séries prévues
const muscu = {
  id: 'circuit',
  name: 'Circuit',
  category: 'muscu',
  days: [],
  createdAt: 1,
  rounds: 3,
  items: [
    { exerciseId: 'pompes', sets: 2, target: 12 },
    { exerciseId: 'gainage', sets: 1, target: 30 },
    { exerciseId: 'squats', sets: 1, target: 20 },
    { exerciseId: 'fentes', sets: 1, target: 15 },
  ],
}
const perRound = 5
const total = perRound * 3

const log = (results) => ({ id: 'l', date: '2026-07-20', sessionId: 'circuit', category: 'muscu', createdAt: 1, results })

let ok = true
const check = (label, got, expect) => {
  if (got !== expect) {
    ok = false
    console.error(`KO ${label}\n  attendu : ${expect}\n  obtenu  : ${got}`)
  }
}

// --- Arrêt au tour 2, sur les squats (tour 1 complet + pompes×2, gainage, squats du tour 2)
const stopped = log([
  { exerciseId: 'pompes', name: 'Pompes', measure: 'reps', sets: [12, 12, 10, 10] },
  { exerciseId: 'gainage', name: 'Gainage', measure: 'sec', sets: [30, 30] },
  { exerciseId: 'squats', name: 'Squats', measure: 'reps', sets: [20, 18] },
  { exerciseId: 'fentes', name: 'Fentes', measure: 'reps', sets: [15] },
])
const sp = stopPoint(stopped, muscu, exercises)
check('stopPoint.where', sp?.where, 'Tour 2/3')
check('stopPoint.name', sp?.name, 'Squats')
check('stopPoint.done', sp?.done, 9)
check('stopPoint.total', sp?.total, total)
check('stopPoint.complete', sp?.complete, false)
check(
  'ligne muscu interrompue',
  lastPerfLine(stopped, muscu, exercises),
  'Arrêté à Tour 2/3 — Squats · Série 1 · 9/15 séries',
)
// Le détail reste disponible, complet : les 4 exercices, plus aucun « … »
const detail = lastDetailLine(stopped)
if (detail.includes('…') || !['Pompes', 'Gainage', 'Squats', 'Fentes'].every((n) => detail.includes(n))) {
  ok = false
  console.error('KO détail tronqué :', detail)
}

// --- Séance complète : pas de point d'arrêt à annoncer
const full = log([
  { exerciseId: 'pompes', name: 'Pompes', measure: 'reps', sets: [12, 12, 12, 12, 12, 12] },
  { exerciseId: 'gainage', name: 'Gainage', measure: 'sec', sets: [30, 30, 30] },
  { exerciseId: 'squats', name: 'Squats', measure: 'reps', sets: [20, 20, 20] },
  { exerciseId: 'fentes', name: 'Fentes', measure: 'reps', sets: [15, 15, 15] },
])
check('ligne muscu complète', lastPerfLine(full, muscu, exercises), 'Séance complète · 15 séries')

// --- Blocs : l'en-tête porte aussi le numéro de bloc
const parBlocs = {
  ...muscu,
  rounds: 1,
  items: [
    { exerciseId: 'pompes', sets: 1, target: 12 },
    { exerciseId: 'gainage', blockBreak: true, blockRounds: 2, sets: 1, target: 30 },
    { exerciseId: 'squats', sets: 1, target: 20 },
  ],
}
const stopBloc = log([
  { exerciseId: 'pompes', name: 'Pompes', measure: 'reps', sets: [12] },
  { exerciseId: 'gainage', name: 'Gainage', measure: 'sec', sets: [30, 30] },
  { exerciseId: 'squats', name: 'Squats', measure: 'reps', sets: [20] },
])
check(
  'ligne muscu par blocs',
  lastPerfLine(stopBloc, parBlocs, exercises),
  'Arrêté à Bloc 2 · Tour 2/2 — Gainage · Série 1 · 4/5 séries',
)

// --- HIIT : tour + exercice, en intervalles
const hiit = {
  id: 'hiit',
  name: 'HIIT',
  category: 'hiit',
  days: [],
  createdAt: 1,
  rounds: 3,
  workSec: 45,
  restSec: 15,
  items: [{ exerciseId: 'pompes' }, { exerciseId: 'squats' }, { exerciseId: 'fentes' }],
}
const hiitLog = {
  ...log([
    { exerciseId: 'pompes', name: 'Pompes', measure: 'sec', sets: [45, 45] },
    { exerciseId: 'squats', name: 'Squats', measure: 'sec', sets: [45, 40] },
    { exerciseId: 'fentes', name: 'Fentes', measure: 'sec', sets: [45] },
  ]),
  category: 'hiit',
}
check(
  'ligne HIIT interrompue',
  lastPerfLine(hiitLog, hiit, exercises),
  'Arrêté à Tour 2/3 — Squats · 5/9 intervalles',
)

// --- Repli : séance vidée depuis (aucune série ne correspond) → détail par exercice, sans « … »
const vide = { ...muscu, items: [] }
check('repli séance vidée', lastPerfLine(stopped, vide, exercises), lastDetailLine(stopped))

console.log(ok ? 'LAST-PERF-STOP OK — tour + exercice d’arrêt, détail complet, HIIT et blocs couverts' : 'LAST-PERF-STOP ÉCHEC')
process.exit(ok ? 0 : 1)
