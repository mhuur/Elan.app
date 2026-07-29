// Vérifie la progression automatique des objectifs (`progressedSession`) : la perf de la dernière
// séance devient la nouvelle cible, sans jamais reculer, sur muscu / étirements / HIIT / vélo.
// Test de logique pure (pas de navigateur) : charge progression.ts via Vite ssrLoadModule.
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
const { progressedSession } = await vite.ssrLoadModule('/src/lib/progression.ts')
const { setTargetsOf } = await vite.ssrLoadModule('/src/types.ts')
await vite.close()

const exercises = [
  { id: 'pompes', name: 'Pompes', category: 'muscu', measure: 'reps', createdAt: 1 },
  { id: 'gainage', name: 'Gainage', category: 'muscu', measure: 'sec', createdAt: 2 },
  { id: 'cobra', name: 'Cobra', category: 'etirements', measure: 'sec', createdAt: 3 },
  { id: 'chat', name: 'Chat-vache', category: 'etirements', measure: 'reps', createdAt: 4 },
]

let ok = true
const check = (label, got, expect) => {
  const g = JSON.stringify(got)
  const e = JSON.stringify(expect)
  if (g !== e) {
    ok = false
    console.error(`KO ${label}\n  attendu : ${e}\n  obtenu  : ${g}`)
  }
}

const log = (extra) => ({ id: 'l1', date: '2026-07-20', sessionId: 's', createdAt: 1, ...extra })
const res = (exerciseId, measure, sets) => ({ exerciseId, name: exerciseId, measure, sets })

// --- Muscu : 3 séries de pompes (objectif 10) + gainage 30 s
const muscu = {
  id: 's',
  name: 'Muscu',
  category: 'muscu',
  days: [],
  createdAt: 1,
  items: [
    { exerciseId: 'pompes', sets: 3, target: 10 },
    { exerciseId: 'gainage', sets: 1, target: 30 },
  ],
}
const muscuTargets = (logs) => {
  const { session, raised } = progressedSession(muscu, exercises, logs, '2026-07-25')
  return { pompes: setTargetsOf(session.items[0]), gainage: setTargetsOf(session.items[1]), raised }
}

check('muscu — perf au-dessus de la cible', muscuTargets([log({ results: [res('pompes', 'reps', [12, 12, 11])] })]), {
  pompes: [12, 12, 11],
  gainage: [30],
  raised: true,
})
check('muscu — perf en baisse : la cible tient', muscuTargets([log({ results: [res('pompes', 'reps', [12, 8, 6])] })]), {
  pompes: [12, 10, 10],
  gainage: [30],
  raised: true,
})
check('muscu — séance interrompue : séries non faites ignorées', muscuTargets([log({ results: [res('pompes', 'reps', [12, 12])] })]), {
  pompes: [12, 12, 10],
  gainage: [30],
  raised: true,
})
check('muscu — gainage en secondes', muscuTargets([log({ results: [res('gainage', 'sec', [45])] })]), {
  pompes: [10, 10, 10],
  gainage: [45],
  raised: true,
})
check('muscu — sans historique, rien ne bouge', muscuTargets([]), { pompes: [10, 10, 10], gainage: [30], raised: false })

// --- Le log le plus récent gagne (et les logs postérieurs à la date affichée sont ignorés)
check(
  'muscu — dernier log seulement',
  muscuTargets([
    log({ id: 'a', date: '2026-07-10', results: [res('pompes', 'reps', [20, 20, 20])] }),
    log({ id: 'b', date: '2026-07-20', results: [res('pompes', 'reps', [12, 12, 12])] }),
    log({ id: 'c', date: '2026-07-30', results: [res('pompes', 'reps', [30, 30, 30])] }),
  ]),
  { pompes: [12, 12, 12], gainage: [30], raised: true },
)

// --- Circuit à 3 tours : la cible ne monte qu'à hauteur du tour le plus faible (tenable à chaque tour)
const circuit = { ...muscu, rounds: 3, items: [{ exerciseId: 'pompes', sets: 1, target: 10 }] }
const circuitTarget = (sets) =>
  setTargetsOf(progressedSession(circuit, exercises, [log({ results: [res('pompes', 'reps', sets)] })], '2026-07-25').session.items[0])
check('circuit — tous les tours au-dessus', circuitTarget([12, 12, 11]), [11])
check('circuit — un tour faible retient la cible', circuitTarget([14, 12, 8]), [10])

// --- Étirements : posture tenue (sec) et mouvement compté (reps)
const stretch = {
  id: 's',
  name: 'Étirements',
  category: 'etirements',
  days: [],
  createdAt: 1,
  items: [
    { exerciseId: 'cobra', durationSec: 30 },
    { exerciseId: 'chat', target: 10 },
  ],
}
const stretched = progressedSession(
  stretch,
  exercises,
  [log({ results: [res('cobra', 'sec', [40]), res('chat', 'reps', [8])] })],
  '2026-07-25',
).session
check('étirements — posture tenue plus longtemps', stretched.items[0].durationSec, 40)
check('étirements — mouvement moins bon : cible inchangée', stretched.items[1].target, 10)

// --- HIIT : durée de travail tenue
const hiit = {
  id: 's',
  name: 'HIIT',
  category: 'hiit',
  days: [],
  createdAt: 1,
  rounds: 2,
  workSec: 45,
  items: [{ exerciseId: 'pompes' }, { exerciseId: 'gainage' }],
}
const hiitDone = progressedSession(
  hiit,
  exercises,
  [log({ results: [res('pompes', 'sec', [50, 48]), res('gainage', 'sec', [45, 30])] })],
  '2026-07-25',
).session
check('HIIT — intervalle tenu plus longtemps', hiitDone.items[0].durationSec, 48)
check('HIIT — intervalle écourté : cible inchangée', hiitDone.items[1].durationSec, undefined)

// --- Vélo : le programme prend les valeurs de la dernière sortie, sauf la FC
const velo = { id: 's', name: 'Vélo', category: 'velo', days: [], createdAt: 1, items: [] }
const veloDone = progressedSession(
  velo,
  exercises,
  [
    log({
      metrics: [
        { key: 'duration', label: 'Durée', unit: 'min', value: 45 },
        { key: 'distance', label: 'Distance', unit: 'km', value: 22 },
        { key: 'bpm', label: 'BPM moyen', unit: 'bpm', value: 152 },
      ],
    }),
  ],
  '2026-07-25',
).session
const targetOf = (key) => veloDone.metrics.find((m) => m.key === key)?.target
check('vélo — durée', targetOf('duration'), 45)
check('vélo — distance', targetOf('distance'), 22)
check('vélo — la FC ne devient jamais un objectif', targetOf('bpm'), undefined)

// --- Course à pied : hors progression (aucune cible saisie dans l'app)
const run = { id: 's', name: 'Footing', category: 'running', days: [], createdAt: 1, items: [] }
const runOut = progressedSession(run, exercises, [log({ metrics: [{ key: 'duration', label: 'Durée', unit: 'min', value: 60 }] })], '2026-07-25')
check('running — inchangé', runOut.raised, false)
check('running — même objet', runOut.session === run, true)

console.log(ok ? 'PROGRESSION OK — objectifs relevés sans jamais reculer (muscu, circuits, étirements, HIIT, vélo)' : 'PROGRESSION ÉCHEC')
process.exit(ok ? 0 : 1)
