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
import type { Exercise, Log, Session } from '../types'
import { FirestoreStore, LocalStore, type Store, type StoreData } from './store'
import { runSeed } from './seed'

interface DataCtx {
  mode: 'local' | 'cloud'
  user: User | null
  authReady: boolean
  dataReady: boolean
  exercises: Exercise[]
  sessions: Session[]
  logs: Log[]
  addExercise(e: Omit<Exercise, 'id'>): Promise<string>
  updateExercise(id: string, patch: Partial<Exercise>): Promise<void>
  removeExercise(id: string): Promise<void>
  addSession(s: Omit<Session, 'id'>): Promise<string>
  updateSession(id: string, patch: Partial<Session>): Promise<void>
  removeSession(id: string): Promise<void>
  addLog(l: Omit<Log, 'id'>): Promise<string>
  removeLog(id: string): Promise<void>
  signIn(): Promise<void>
  signOut(): Promise<void>
  exportAll(): Promise<StoreData>
  importAll(data: Partial<StoreData>): Promise<void>
}

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
  const [dataReady, setDataReady] = useState(false)
  const seedCheckedRef = useRef(false)

  // Authentification (mode cloud uniquement)
  useEffect(() => {
    if (!firebaseEnabled || !auth) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setStore(u && db ? new FirestoreStore(db, u.uid) : null)
      seedCheckedRef.current = false
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
    return () => {
      u1()
      u2()
      u3()
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
      removeLog: (id) => need().remove('logs', id),
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
    }),
    [mode, user, authReady, dataReady, exercises, sessions, logs, need],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
