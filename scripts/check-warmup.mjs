// Vérifie `warmupsDueOn` (échauffement automatique, Session.warmupFor) : la séance
// s'invite quand une séance de sa catégorie cible est à faire (course du plan OU séance
// utilisateur planifiée), disparaît une fois faite ou sans déclencheur, ne se duplique
// pas si elle est déjà planifiée elle-même. Logique pure, via Vite ssrLoadModule.
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
const { warmupsDueOn } = await vite.ssrLoadModule('/src/lib/planDay.ts')
await vite.close()

const warmup = { id: 'w', name: 'Échauffement course', category: 'etirements', warmupFor: 'running', days: [], items: [], createdAt: 1 }
const velo = { id: 'v', name: 'Vélo', category: 'velo', days: [0], items: [], createdAt: 2 }
const warmupVelo = { id: 'wv', name: 'Échauffement vélo', category: 'etirements', warmupFor: 'velo', days: [], items: [], createdAt: 3 }
const sessions = [warmup, velo, warmupVelo]

// Une séance du plan à faire (seule la présence compte pour le déclenchement)
const planRun = [{ seance: { type: 'footing' }, date: '2026-08-24', planRef: 'elan-2026-08-24', done: false }]

const ids = (r) => r.map((s) => s.id).join(',')
const cases = [
  ['course du plan à faire → échauffement course invité', ids(warmupsDueOn(sessions, planRun, new Set(), new Set())), 'w'],
  ['aucun déclencheur → rien', ids(warmupsDueOn(sessions, [], new Set(), new Set())), ''],
  ['échauffement déjà journalisé → absent', ids(warmupsDueOn(sessions, planRun, new Set(), new Set(['w']))), ''],
  ['vélo planifié → échauffement vélo invité', ids(warmupsDueOn(sessions, [], new Set(['v']), new Set())), 'wv'],
  ['vélo déjà fait → plus d’échauffement vélo', ids(warmupsDueOn(sessions, [], new Set(['v']), new Set(['v']))), ''],
  [
    'échauffement lui-même planifié ce jour → pas de doublon via warmupFor',
    ids(warmupsDueOn(sessions, planRun, new Set(['w']), new Set())),
    '',
  ],
]

let ok = true
for (const [label, got, exp] of cases) {
  if (got !== exp) {
    ok = false
    console.error(`KO ${label} : attendu « ${exp} », obtenu « ${got} »`)
  }
}
console.log(ok ? 'WARMUP OK — invitation, disparition une fois fait, pas de doublon' : 'WARMUP ÉCHEC')
process.exit(ok ? 0 : 1)
