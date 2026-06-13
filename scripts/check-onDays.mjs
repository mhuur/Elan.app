// Vérifie la planification « alternance sur jours de semaine choisis » (repeat.onDays) :
// un cycle HIIT/Vélo posé sur lun/jeu/sam tombe bien sur ces jours, jamais sur les jours
// de course (mar/mer/ven/dim), et l'alternance continue d'une semaine à l'autre.
// Test de logique pure (pas de navigateur) : charge schedule.ts via Vite ssrLoadModule.
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
const { plannedSessionIdsOn, describeSchedule } = await vite.ssrLoadModule('/src/lib/schedule.ts')
await vite.close()

// Cycle Vélo ↔ HIIT posé sur lundi(0)/jeudi(3)/samedi(5), départ lundi 15 juin 2026
const sessions = [
  {
    id: 'velo',
    name: 'Vélo',
    category: 'velo',
    days: [],
    createdAt: 1,
    repeat: { everyDays: 2, startDate: '2026-06-15', onDays: [0, 3, 5], steps: [{ ids: ['velo'] }, { ids: ['hiit'] }] },
  },
  { id: 'hiit', name: 'HIIT', category: 'hiit', days: [], createdAt: 2 },
]

const onDate = (dStr) => [...plannedSessionIdsOn(new Date(dStr + 'T12:00:00'), sessions)].sort()

// Attendu : lun/jeu/sam alternent Vélo/HIIT ; mar/mer/ven/dim (jours de course) = rien
const expected = {
  '2026-06-15': ['velo'], // lundi  S1 (occ 0)
  '2026-06-16': [], // mardi   (course)
  '2026-06-17': [], // mercredi (course)
  '2026-06-18': ['hiit'], // jeudi  S1 (occ 1)
  '2026-06-19': [], // vendredi (course)
  '2026-06-20': ['velo'], // samedi S1 (occ 2)
  '2026-06-21': [], // dimanche (course)
  '2026-06-22': ['hiit'], // lundi  S2 (occ 3) → l'alternance continue
  '2026-06-25': ['velo'], // jeudi  S2 (occ 4)
  '2026-06-27': ['hiit'], // samedi S2 (occ 5)
}

let ok = true
for (const [d, exp] of Object.entries(expected)) {
  const got = onDate(d)
  if (JSON.stringify(got) !== JSON.stringify(exp.slice().sort())) {
    ok = false
    console.error(`KO ${d} : attendu ${JSON.stringify(exp)}, obtenu ${JSON.stringify(got)}`)
  }
}

const desc = describeSchedule(sessions[0], sessions)
if (!(desc.includes('Lun') && desc.includes('Jeu') && desc.includes('Sam') && desc.includes('alternance'))) {
  ok = false
  console.error('KO describeSchedule :', desc)
}

console.log(ok ? `ONDAYS OK — alternance lun/jeu/sam, jamais les jours de course, alternance continue (« ${desc} »)` : 'ONDAYS ÉCHEC')
process.exit(ok ? 0 : 1)
