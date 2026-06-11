import type { Category, Exercise, Measure, Session, SessionItem } from '../types'
import { youtubeSearch } from '../lib/format'
import { DEFAULT_VELO_METRICS } from '../lib/metrics'
import type { Store, StoreDoc } from './store'

interface SeedEx {
  name: string
  category: Category
  subtype?: string
  measure?: Measure
  description?: string
}

const SEED_EXERCISES: SeedEx[] = [
  // Muscu au poids du corps
  { name: 'Pompes', category: 'muscu', subtype: 'Pectoraux' },
  { name: 'Squats', category: 'muscu', subtype: 'Jambes' },
  { name: 'Fentes', category: 'muscu', subtype: 'Jambes' },
  { name: 'Gainage', category: 'muscu', subtype: 'Abdominaux', measure: 'sec' },
  { name: 'Gainage latéral', category: 'muscu', subtype: 'Abdominaux', measure: 'sec' },
  { name: 'Tractions', category: 'muscu', subtype: 'Dos' },
  { name: 'Dips', category: 'muscu', subtype: 'Bras' },
  { name: 'Crunchs', category: 'muscu', subtype: 'Abdominaux' },
  { name: 'Pont fessier', category: 'muscu', subtype: 'Fessiers' },
  { name: 'Superman', category: 'muscu', subtype: 'Dos' },
  // HIIT
  { name: 'Burpees', category: 'hiit', subtype: 'Cardio' },
  { name: 'Mountain climbers', category: 'hiit', subtype: 'Cardio' },
  { name: 'Jumping jacks', category: 'hiit', subtype: 'Cardio' },
  { name: 'Squats sautés', category: 'hiit', subtype: 'Jambes' },
  { name: 'Montées de genoux', category: 'hiit', subtype: 'Cardio' },
  { name: 'Planche commando', category: 'hiit', subtype: 'Abdominaux' },
  { name: 'Fentes sautées', category: 'hiit', subtype: 'Jambes' },
  // Étirements
  { name: 'Ischio-jambiers', category: 'etirements', subtype: 'Souplesse', description: 'Jambes tendues, penchez-vous doucement vers l’avant.' },
  { name: 'Quadriceps debout', category: 'etirements', subtype: 'Souplesse', description: 'Talon vers la fesse, genoux serrés.' },
  { name: 'Mollets au mur', category: 'etirements', subtype: 'Souplesse' },
  { name: 'Pigeon (hanches)', category: 'etirements', subtype: 'Mobilité' },
  { name: 'Chat-vache (dos)', category: 'etirements', subtype: 'Mobilité' },
  { name: 'Posture de l’enfant', category: 'etirements', subtype: 'Mobilité' },
  { name: 'Papillon (adducteurs)', category: 'etirements', subtype: 'Souplesse' },
  { name: 'Cobra', category: 'etirements', subtype: 'Mobilité' },
  { name: 'Torsion allongée', category: 'etirements', subtype: 'Mobilité' },
  { name: 'Épaules croisées', category: 'etirements', subtype: 'Souplesse' },
]

/** Sous-types des exercices du jeu de départ, pour enrichir les données déjà créées */
export const SUBTYPE_BY_NAME: Record<string, string> = Object.fromEntries(
  SEED_EXERCISES.filter((e) => e.subtype).map((e) => [e.name, e.subtype!]),
)

/**
 * Jeu de départ : exercices + séances types, créés au premier lancement
 * pour que l'app soit utilisable immédiatement. Tout est modifiable ensuite.
 */
export function buildSeed(): { exercises: Exercise[]; sessions: Session[] } {
  const now = Date.now()
  const exercises: Exercise[] = SEED_EXERCISES.map((e, i) => ({
    id: crypto.randomUUID(),
    name: e.name,
    category: e.category,
    measure: e.measure ?? 'reps',
    videoUrl: youtubeSearch(e.name),
    createdAt: now + i,
    ...(e.subtype ? { subtypes: [e.subtype] } : {}),
    ...(e.description ? { description: e.description } : {}),
  }))

  const byName = new Map(exercises.map((e) => [e.name, e]))
  const item = (name: string, extra?: Partial<SessionItem>): SessionItem => ({
    exerciseId: byName.get(name)!.id,
    ...extra,
  })

  const sessions: Session[] = [
    {
      id: crypto.randomUUID(),
      name: 'Sortie courte',
      category: 'running',
      days: [],
      items: [],
      notes: 'Footing tranquille, 30-40 min',
      sortOrder: 0,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      name: 'Sortie longue',
      category: 'running',
      days: [],
      items: [],
      notes: 'Endurance fondamentale, 1 h et plus',
      sortOrder: 1,
      createdAt: now + 1,
    },
    {
      id: crypto.randomUUID(),
      name: 'Fractionné',
      category: 'running',
      days: [],
      items: [],
      notes: 'Ex. 8 × 400 m, récup 1 min',
      sortOrder: 2,
      createdAt: now + 2,
    },
    {
      id: crypto.randomUUID(),
      name: 'Vélo d’appartement',
      category: 'velo',
      days: [],
      items: [],
      metrics: DEFAULT_VELO_METRICS,
      sortOrder: 3,
      createdAt: now + 3,
    },
    {
      id: crypto.randomUUID(),
      name: 'Muscu — Full body',
      category: 'muscu',
      days: [],
      items: [
        item('Pompes', { sets: 3, target: 12 }),
        item('Squats', { sets: 3, target: 15 }),
        item('Fentes', { sets: 3, target: 10, comment: '10 par jambe' }),
        item('Gainage', { sets: 3, target: 45, comment: 'Dos bien droit, ne pas creuser' }),
        item('Pont fessier', { sets: 3, target: 15 }),
      ],
      sortOrder: 4,
      createdAt: now + 4,
    },
    {
      id: crypto.randomUUID(),
      name: 'HIIT — Cardio express',
      category: 'hiit',
      days: [],
      items: [
        item('Burpees'),
        item('Mountain climbers'),
        item('Jumping jacks'),
        item('Squats sautés'),
        item('Montées de genoux'),
      ],
      workSec: 45,
      restSec: 15,
      rounds: 2,
      sortOrder: 5,
      createdAt: now + 5,
    },
    {
      id: crypto.randomUUID(),
      name: 'Routine matinale',
      category: 'etirements',
      days: [0, 1, 2, 3, 4, 5, 6],
      items: [
        item('Chat-vache (dos)', { durationSec: 40 }),
        item('Posture de l’enfant', { durationSec: 40 }),
        item('Cobra', { durationSec: 30 }),
        item('Pigeon (hanches)', { durationSec: 40 }),
        item('Ischio-jambiers', { durationSec: 40 }),
        item('Papillon (adducteurs)', { durationSec: 30 }),
        item('Torsion allongée', { durationSec: 40 }),
      ],
      sortOrder: 6,
      createdAt: now + 6,
    },
  ]

  return { exercises, sessions }
}

export async function runSeed(store: Store): Promise<void> {
  const { exercises, sessions } = buildSeed()
  await store.importAll({
    exercises: exercises as unknown as StoreDoc[],
    sessions: sessions as unknown as StoreDoc[],
  })
}
