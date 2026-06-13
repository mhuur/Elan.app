import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import type { ColName } from '../types'

export type StoreDoc = { id: string } & Record<string, unknown>
export type StoreData = Record<ColName, StoreDoc[]>

/**
 * Abstraction du stockage : LocalStore (localStorage, sans compte)
 * ou FirestoreStore (cloud synchronisé). Même interface pour toute l'app.
 */
export interface Store {
  readonly mode: 'local' | 'cloud'
  subscribe(col: ColName, cb: (docs: StoreDoc[]) => void): () => void
  add(col: ColName, data: Record<string, unknown>): Promise<string>
  update(col: ColName, id: string, data: Record<string, unknown>): Promise<void>
  remove(col: ColName, id: string): Promise<void>
  exportAll(): Promise<StoreData>
  importAll(data: Partial<StoreData>): Promise<void>
}

const COLS: ColName[] = ['exercises', 'sessions', 'logs', 'ideas', 'activities']

/** Firestore refuse `undefined` : on nettoie récursivement */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => clean(v)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, clean(v)]),
    ) as T
  }
  return value
}

// ---------------------------------------------------------------- LocalStore

const LOCAL_KEY = 'elan-data-v1'

function emptyData(): StoreData {
  return { exercises: [], sessions: [], logs: [], ideas: [], activities: [] }
}

export class LocalStore implements Store {
  readonly mode = 'local' as const
  private data: StoreData
  private listeners: Record<ColName, Set<(docs: StoreDoc[]) => void>> = {
    exercises: new Set(),
    sessions: new Set(),
    logs: new Set(),
    ideas: new Set(),
    activities: new Set(),
  }

  constructor() {
    this.data = emptyData()
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoreData>
        for (const col of COLS) {
          if (Array.isArray(parsed[col])) this.data[col] = parsed[col]
        }
      }
    } catch {
      // données corrompues : on repart à vide
    }
  }

  private persist() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(this.data))
  }

  private emit(col: ColName) {
    for (const cb of this.listeners[col]) cb([...this.data[col]])
  }

  subscribe(col: ColName, cb: (docs: StoreDoc[]) => void): () => void {
    this.listeners[col].add(cb)
    cb([...this.data[col]])
    return () => this.listeners[col].delete(cb)
  }

  async add(col: ColName, data: Record<string, unknown>): Promise<string> {
    const id = crypto.randomUUID()
    this.data[col].push({ ...clean(data), id })
    this.persist()
    this.emit(col)
    return id
  }

  async update(col: ColName, id: string, data: Record<string, unknown>): Promise<void> {
    const i = this.data[col].findIndex((d) => d.id === id)
    if (i === -1) return
    this.data[col][i] = clean({ ...this.data[col][i], ...data, id })
    this.persist()
    this.emit(col)
  }

  async remove(col: ColName, id: string): Promise<void> {
    this.data[col] = this.data[col].filter((d) => d.id !== id)
    this.persist()
    this.emit(col)
  }

  async exportAll(): Promise<StoreData> {
    return JSON.parse(JSON.stringify(this.data)) as StoreData
  }

  async importAll(data: Partial<StoreData>): Promise<void> {
    for (const col of COLS) {
      const incoming = data[col]
      if (!Array.isArray(incoming)) continue
      const byId = new Map(this.data[col].map((d) => [d.id, d]))
      for (const docIn of incoming) {
        if (docIn && typeof docIn.id === 'string') byId.set(docIn.id, clean(docIn))
      }
      this.data[col] = [...byId.values()]
      this.emit(col)
    }
    this.persist()
  }
}

// ------------------------------------------------------------ FirestoreStore

export class FirestoreStore implements Store {
  readonly mode = 'cloud' as const

  constructor(
    private db: Firestore,
    private uid: string,
  ) {}

  private colRef(col: ColName) {
    return collection(this.db, 'users', this.uid, col)
  }

  subscribe(col: ColName, cb: (docs: StoreDoc[]) => void): () => void {
    return onSnapshot(
      this.colRef(col),
      (snap) => {
        cb(snap.docs.map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id })))
      },
      () => {
        // Règles Firestore restrictives sur une collection ajoutée après coup :
        // on dégrade en liste vide plutôt que de bloquer le chargement.
        cb([])
      },
    )
  }

  async add(col: ColName, data: Record<string, unknown>): Promise<string> {
    const ref = await addDoc(this.colRef(col), clean(data))
    return ref.id
  }

  async update(col: ColName, id: string, data: Record<string, unknown>): Promise<void> {
    await updateDoc(doc(this.colRef(col), id), clean(data))
  }

  async remove(col: ColName, id: string): Promise<void> {
    await deleteDoc(doc(this.colRef(col), id))
  }

  async exportAll(): Promise<StoreData> {
    const out = emptyData()
    for (const col of COLS) {
      try {
        const snap = await getDocs(this.colRef(col))
        out[col] = snap.docs.map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }))
      } catch {
        // collection inaccessible (règles) : on l'omet de l'export
      }
    }
    return out
  }

  async importAll(data: Partial<StoreData>): Promise<void> {
    for (const col of COLS) {
      const incoming = data[col]
      if (!Array.isArray(incoming)) continue
      // Lots de 400 (limite Firestore : 500 opérations par batch)
      for (let i = 0; i < incoming.length; i += 400) {
        const batch = writeBatch(this.db)
        for (const docIn of incoming.slice(i, i + 400)) {
          if (!docIn || typeof docIn.id !== 'string') continue
          const { id, ...rest } = docIn
          batch.set(doc(this.colRef(col), id), clean(rest))
        }
        await batch.commit()
      }
    }
  }
}
