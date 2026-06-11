import type { Category, Exercise, Measure, Session, SessionItem } from '../types'
import { youtubeSearch } from '../lib/format'
import { DEFAULT_VELO_METRICS } from '../lib/metrics'
import type { Store, StoreDoc } from './store'

interface SeedEx {
  name: string
  category: Category
  measure?: Measure
  description?: string
}

const SEED_EXERCISES: SeedEx[] = [
  // Muscu au poids du corps
  { name: 'Pompes', category: 'muscu' },
  { name: 'Squats', category: 'muscu' },
  { name: 'Fentes', category: 'muscu' },
  { name: 'Gainage', category: 'muscu', measure: 'sec' },
  { name: 'Gainage latéral', category: 'muscu', measure: 'sec' },
  { name: 'Tractions', category: 'muscu' },
  { name: 'Dips', category: 'muscu' },
  { name: 'Crunchs', category: 'muscu' },
  { name: 'Pont fessier', category: 'muscu' },
  { name: 'Superman', category: 'muscu' },
  // HIIT
  { name: 'Burpees', category: 'hiit' },
  { name: 'Mountain climbers', category: 'hiit' },
  { name: 'Jumping jacks', category: 'hiit' },
  { name: 'Squats sautés', category: 'hiit' },
  { name: 'Montées de genoux', category: 'hiit' },
  { name: 'Planche commando', category: 'hiit' },
  { name: 'Fentes sautées', category: 'hiit' },
  // Étirements
  { name: 'Ischio-jambiers', category: 'etirements', description: 'Jambes tendues, penchez-vous doucement vers l’avant.' },
  { name: 'Quadriceps debout', category: 'etirements', description: 'Talon vers la fesse, genoux serrés.' },
  { name: 'Mollets au mur', category: 'etirements' },
  { name: 'Pigeon (hanches)', category: 'etirements' },
  { name: 'Chat-vache (dos)', category: 'etirements' },
  { name: 'Posture de l’enfant', category: 'etirements' },
  { name: 'Papillon (adducteurs)', category: 'etirements' },
  { name: 'Cobra', category: 'etirements' },
  { name: 'Torsion allongée', category: 'etirements' },
  { name: 'Épaules croisées', category: 'etirements' },
]

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
