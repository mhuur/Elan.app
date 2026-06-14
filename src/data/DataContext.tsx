import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { auth, db, firebaseEnabled } from '../firebase'
import type { Activity, Exercise, Idea, Log, Session } from '../types'
import { FirestoreStore, LocalStore, type Store, type StoreData } from './store'
import { runSeed, SUBTYPE_BY_NAME } from './seed'

interface DataCtx {
  mode: 'local' | 'cloud'
  user: User | null
  authReady: boolean
  dataReady: boolean
  exercises: Exercise[]
  sessions: Session[]
  logs: Log[]
  ideas: Idea[]
  /** Courses réelles importées de COROS via intervals.icu (collection en lecture seule côté app) */
  activities: Activity[]
  addExercise(e: Omit<Exercise, 'id'>): Promise<string>
  updateExercise(id: string, patch: Partial<Exercise>): Promise<void>
  removeExercise(id: string): Promise<void>
  addSession(s: Omit<Session, 'id'>): Promise<string>
  updateSession(id: string, patch: Partial<Session>): Promise<void>
  removeSession(id: string): Promise<void>
  addLog(l: Omit<Log, 'id'>): Promise<string>
  updateLog(id: string, patch: Partial<Log>): Promise<void>
  removeLog(id: string): Promise<void>
  addIdea(i: Omit<Idea, 'id'>): Promise<string>
  updateIdea(id: string, patch: Partial<Idea>): Promise<void>
  removeIdea(id: string): Promise<void>
  signIn(): Promise<void>
  signOut(): Promise<void>
  exportAll(): Promise<StoreData>
  importAll(data: Partial<StoreData>): Promise<void>
  /** Synchro Strava configurée (VITE_STRAVA_SYNC_URL présent) → bouton « Synchroniser » visible */
  stravaSyncConfigured: boolean
  /** Importe les courses Strava récentes via le Worker, dédoublonne par externalId. */
  syncStrava(days?: number): Promise<{ added: number; total: number }>
}

const STRAVA_SYNC_URL = import.meta.env.VITE_STRAVA_SYNC_URL as string | undefined
const STRAVA_SYNC_KEY = import.meta.env.VITE_STRAVA_SYNC_KEY as string | undefined

const Ctx = createContext<DataCtx | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useData doit être utilisé sous <DataProvider>')
  return c
}

export function DataProvider({ children }: { children: ReactNode }) {
  const mode: 'local' | 'cloud' = firebaseEnabled ? 'cloud' : 'local'
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!firebaseEnabled)
  const [store, setStore] = useState<Store | null>(() => (firebaseEnabled ? null : new LocalStore()))
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [dataReady, setDataReady] = useState(false)
  const seedCheckedRef = useRef(false)
  const migCheckedRef = useRef(false)

  // Authentification (mode cloud uniquement)
  useEffect(() => {
    if (!firebaseEnabled || !auth) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setStore(u && db ? new FirestoreStore(db, u.uid) : null)
      seedCheckedRef.current = false
      migCheckedRef.current = false
      setAuthReady(true)
    })
  }, [])

  // Abonnements aux trois collections
  useEffect(() => {
    if (!store) {
      setDataReady(false)
      setExercises([])
      setSessions([])
      setLogs([])
      setActivities([])
      return
    }
    const flags = { exercises: false, sessions: false, logs: false }
    const checkReady = () => {
      if (flags.exercises && flags.sessions && flags.logs) setDataReady(true)
    }
    const u1 = store.subscribe('exercises', (d) => {
      setExercises((d as unknown as Exercise[]).slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')))
      flags.exercises = true
      checkReady()
    })
    const u2 = store.subscribe('sessions', (d) => {
      setSessions(
        (d as unknown as Session[])
          .slice()
          .sort(
            (a, b) =>
              (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
              a.createdAt - b.createdAt,
          ),
      )
      flags.sessions = true
      checkReady()
    })
    const u3 = store.subscribe('logs', (d) => {
      setLogs(
        (d as unknown as Log[]).slice().sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date))),
      )
      flags.logs = true
      checkReady()
    })
    // Les idées ne conditionnent pas dataReady (collection ajoutée après coup)
    const u4 = store.subscribe('ideas', (d) => {
      setIdeas((d as unknown as Idea[]).slice().sort((a, b) => b.createdAt - a.createdAt))
    })
    // Les courses importées (intervals.icu) ne conditionnent pas dataReady non plus
    const u5 = store.subscribe('activities', (d) => {
      setActivities((d as unknown as Activity[]).slice().sort((a, b) => b.date.localeCompare(a.date)))
    })
    return () => {
      u1()
      u2()
      u3()
      u4()
      u5()
      setDataReady(false)
    }
  }, [store])

  // Premier lancement : on installe les exercices et séances de départ
  useEffect(() => {
    if (!store || !dataReady || seedCheckedRef.current) return
    seedCheckedRef.current = true
    if (exercises.length || sessions.length || logs.length) return
    const key = `elan-seeded-${mode === 'cloud' && user ? user.uid : 'local'}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    void runSeed(store)
  }, [store, dataReady, exercises.length, sessions.length, logs.length, mode, user])

  // Migration douce : ajoute les sous-types aux exercices du jeu de départ déjà créés
  useEffect(() => {
    if (!store || !dataReady || migCheckedRef.current || !exercises.length) return
    migCheckedRef.current = true
    const key = `elan-mig-subtypes-${mode === 'cloud' && user ? user.uid : 'local'}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    for (const e of exercises) {
      if (!e.subtype && !e.subtypes?.length && SUBTYPE_BY_NAME[e.name]) {
        void store.update('exercises', e.id, { subtypes: [SUBTYPE_BY_NAME[e.name]] })
      }
    }
  }, [store, dataReady, exercises, mode, user])

  const need = useCallback((): Store => {
    if (!store) throw new Error('Stockage non initialisé')
    return store
  }, [store])

  const value = useMemo<DataCtx>(
    () => ({
      mode,
      user,
      authReady,
      dataReady,
      exercises,
      sessions,
      logs,
      ideas,
      activities,
      addExercise: (e) => need().add('exercises', e as unknown as Record<string, unknown>),
      updateExercise: (id, patch) => need().update('exercises', id, patch as Record<string, unknown>),
      removeExercise: async (id) => {
        const s = need()
        // Retire l'exercice des séances qui l'utilisent
        await Promise.all(
          sessions
            .filter((se) => se.items.some((i) => i.exerciseId === id))
            .map((se) =>
              s.update('sessions', se.id, {
                items: se.items.filter((i) => i.exerciseId !== id) as unknown as Record<string, unknown>[],
              }),
            ),
        )
        await s.remove('exercises', id)
      },
      addSession: (se) => need().add('sessions', se as unknown as Record<string, unknown>),
      updateSession: (id, patch) => need().update('sessions', id, patch as Record<string, unknown>),
      removeSession: (id) => need().remove('sessions', id),
      addLog: (l) => need().add('logs', l as unknown as Record<string, unknown>),
      updateLog: (id, patch) => need().update('logs', id, patch as Record<string, unknown>),
      removeLog: (id) => need().remove('logs', id),
      addIdea: (i) => need().add('ideas', i as unknown as Record<string, unknown>),
      updateIdea: (id, patch) => need().update('ideas', id, patch as Record<string, unknown>),
      removeIdea: (id) => need().remove('ideas', id),
      signIn: async () => {
        if (!auth) return
        const provider = new GoogleAuthProvider()
        try {
          await signInWithPopup(auth, provider)
        } catch (e) {
          const code = (e as { code?: string }).code
          if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, provider)
          } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
            throw e
          }
        }
      },
      signOut: async () => {
        if (auth) await fbSignOut(auth)
      },
      exportAll: () => need().exportAll(),
      importAll: (data) => need().importAll(data),
      stravaSyncConfigured: !!STRAVA_SYNC_URL,
      syncStrava: async (days = 30) => {
        if (!STRAVA_SYNC_URL) throw new Error('Synchro Strava non configurée')
        const s = need()
        const res = await fetch(`${STRAVA_SYNC_URL}?days=${days}`, {
          headers: STRAVA_SYNC_KEY ? { Authorization: 'Bearer ' + STRAVA_SYNC_KEY } : undefined,
        })
        if (!res.ok) throw new Error('Strava ' + res.status)
        const { activities: incoming } = (await res.json()) as { activities: Activity[] }
        const known = new Set(activities.map((a) => a.externalId).filter(Boolean))
        let added = 0
        for (const a of incoming) {
          if (a.externalId && known.has(a.externalId)) continue
          await s.add('activities', a as unknown as Record<string, unknown>)
          added++
        }
        return { added, total: incoming.length }
      },
    }),
    [mode, user, authReady, dataReady, exercises, sessions, logs, ideas, activities, need],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
