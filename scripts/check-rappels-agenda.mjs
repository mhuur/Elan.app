// Vérifie l'agenda envoyé au Worker de rappels (src/lib/reminderAgenda.ts).
//
// L'enjeu : cet agenda est LA source des notifications. S'il liste une séance déjà faite, on
// se fait réveiller pour rien ; s'il en oublie une, on rate sa séance. Il doit donc voir
// exactement ce que voit l'écran « Aujourd'hui » — d'où la réutilisation de
// plannedSessionIdsOn / planToDoOn plutôt qu'une logique parallèle.
//
// Test de logique pure (pas de navigateur) : charge reminderAgenda.ts via Vite ssrLoadModule.
// Usage : node scripts/check-rappels-agenda.mjs
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
const { buildAgenda, agendaFingerprint } = await vite.ssrLoadModule('/src/lib/reminderAgenda.ts')
await vite.close()

let failures = 0
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'} ${label}${ok ? '' : `\n         attendu ${e}\n         obtenu  ${a}`}`)
}

// Jeudi 9 juillet 2026. La semaine du plan démarrant le lundi 6 pose ses courses les
// mar. 7, mer. 8, ven. 10 et dim. 12 — le jeudi 9 est donc libre de course.
const FROM = new Date('2026-07-09T12:00:00')
const JEUDI = '2026-07-09'
const VENDREDI = '2026-07-10'
const DIMANCHE = '2026-07-12'

// Gainage le jeudi (jour 3), Vélo le vendredi (jour 4)
const sessions = [
  { id: 'gainage', name: 'Gainage', category: 'muscu', days: [3], items: [], createdAt: 1 },
  { id: 'velo', name: 'Vélo', category: 'velo', days: [4], items: [], createdAt: 2 },
]
const agendaDe = (logs, s = sessions) => buildAgenda(s, logs, 5, FROM)

console.log('\nSéances utilisateur et séances du plan')
{
  const a = agendaDe([])
  check('jeudi : le gainage seul', a[JEUDI], ['Gainage'])
  check('vendredi : vélo + la course du plan', a[VENDREDI], ['Vélo', 'Footing 6 km'])
  check('dimanche : la sortie longue du plan', a[DIMANCHE], ['Sortie longue 9 km'])
}

console.log('\nJours de repos : aucune entrée (donc aucun push)')
{
  const a = agendaDe([])
  check('samedi 11 absent de l’agenda', '2026-07-11' in a, false)
  check('seuls les jours utiles sont listés', Object.keys(a).sort(), [JEUDI, VENDREDI, DIMANCHE])
}

console.log('\nUne séance validée quitte l’agenda')
{
  const log = { id: 'l1', date: JEUDI, sessionId: 'gainage', sessionName: 'Gainage', category: 'muscu', createdAt: 1 }
  const a = agendaDe([log])
  check('gainage validé → jeudi disparaît', JEUDI in a, false)
  check('vendredi intact', a[VENDREDI], ['Vélo', 'Footing 6 km'])
}

console.log('\nUne course du plan validée quitte l’agenda')
{
  // Validation explicite : un log portant le planRef du jour prévu
  const log = { id: 'l2', date: VENDREDI, sessionId: '', sessionName: 'Footing 6 km', category: 'running', planRef: 'elan-' + VENDREDI, createdAt: 1 }
  const a = agendaDe([log])
  check('vendredi : le vélo reste, la course part', a[VENDREDI], ['Vélo'])
}
{
  // Course LIBRE le jour prévu : couvre aussi la séance du plan (cf. planWeekStates)
  const log = { id: 'l3', date: DIMANCHE, sessionId: '', sessionName: 'Sortie', category: 'running', createdAt: 1 }
  const a = agendaDe([log])
  check('course libre le dimanche → sortie longue couverte', DIMANCHE in a, false)
}

console.log('\nUn log du plan ne valide PAS une séance utilisateur')
{
  // Piège réel (audit P2) : `planRef` est LE discriminant. Un log du plan tombant le jeudi
  // ne doit pas faire disparaître le gainage, même si son sessionId était renseigné.
  const log = { id: 'l4', date: JEUDI, sessionId: 'gainage', sessionName: 'x', category: 'running', planRef: 'elan-' + JEUDI, createdAt: 1 }
  const a = agendaDe([log])
  check('le gainage reste dû', a[JEUDI], ['Gainage'])
}

console.log('\nCycles d’alternance (le Worker ne saurait pas les calculer)')
{
  // Vélo ↔ HIIT en alternance sur lun/jeu/sam, départ lundi 6 juillet.
  // Occurrences : lun 6 → Vélo, jeu 9 → HIIT, sam 11 → Vélo.
  const cycliques = [
    {
      id: 'velo', name: 'Vélo', category: 'velo', days: [], items: [], createdAt: 1,
      repeat: { everyDays: 2, startDate: '2026-07-06', onDays: [0, 3, 5], steps: [{ ids: ['velo'] }, { ids: ['hiit'] }] },
    },
    { id: 'hiit', name: 'HIIT', category: 'hiit', days: [], items: [], createdAt: 2 },
  ]
  const a = agendaDe([], cycliques)
  check('jeudi 9 → HIIT (2e étape du cycle)', a[JEUDI], ['HIIT'])
  check('samedi 11 → Vélo (retour 1re étape)', a['2026-07-11'], ['Vélo'])
  check('vendredi 10 → la course du plan seule', a[VENDREDI], ['Footing 6 km'])
}

console.log('\nHorizon et empreinte')
{
  check('l’horizon borne le nombre de jours', Object.keys(buildAgenda(sessions, [], 2, FROM)).sort(), [JEUDI, VENDREDI])
  const a1 = agendaDe([])
  const a2 = agendaDe([])
  check('empreinte stable à contenu égal', agendaFingerprint(a1) === agendaFingerprint(a2), true)
  const log = { id: 'l5', date: JEUDI, sessionId: 'gainage', sessionName: 'Gainage', category: 'muscu', createdAt: 1 }
  check('empreinte change quand l’agenda change', agendaFingerprint(a1) !== agendaFingerprint(agendaDe([log])), true)
}

console.log(failures ? `\n❌ ${failures} vérification(s) en échec` : '\n✅ Agenda des rappels conforme')
process.exit(failures ? 1 : 0)
