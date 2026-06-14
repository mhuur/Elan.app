import { useRef, useState } from 'react'
import { Bug, Check, Cloud, Download, RefreshCw, Smartphone, Upload, X } from 'lucide-react'
import { useData } from '../data/DataContext'
import { todayStr } from '../lib/dates'
import { formatLastSync, useStravaSync } from '../lib/useStravaSync'
import type { StoreData } from '../data/store'
import { GhostButton, Sheet } from './ui'

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode, user, signOut, exportAll, importAll, ideas, addIdea, updateIdea, removeIdea } = useData()
  const strava = useStravaSync()
  const fileRef = useRef<HTMLInputElement>(null)
  const [ideaText, setIdeaText] = useState('')

  const submitIdea = async () => {
    const text = ideaText.trim()
    if (!text) return
    await addIdea({ text, done: false, createdAt: Date.now() })
    setIdeaText('')
  }

  const doExport = async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `elan-sauvegarde-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Partial<StoreData>
      if (!window.confirm('Importer cette sauvegarde ? Elle sera fusionnée avec vos données actuelles.')) return
      await importAll(data)
      window.alert('Import terminé ✓')
      onClose()
    } catch {
      window.alert('Fichier invalide.')
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Réglages">
      <div className="space-y-3">
        {mode === 'cloud' ? (
          <div className="flex items-start gap-2.5 rounded-2xl bg-sage-50 p-4 text-sm font-semibold text-ink-soft">
            <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" />
            <span>
              Connecté en tant que <span className="text-ink">{user?.email}</span>
              <br />
              Vos données sont synchronisées sur tous vos appareils.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-2xl bg-sage-50 p-4 text-sm font-semibold text-ink-soft">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" />
            <span>
              <span className="text-ink">Mode local</span> : vos données restent sur cet appareil.
              <br />
              Pour les synchroniser entre téléphone et ordinateur, configurez Firebase (guide dans le fichier README du
              projet), ou utilisez l'export/import ci-dessous.
            </span>
          </div>
        )}

        {strava.configured && (
          <div className="rounded-2xl bg-sage-50 p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
              <RefreshCw className="h-3.5 w-3.5" /> Courses Strava
            </h3>
            <button
              type="button"
              onClick={() => void strava.sync()}
              disabled={strava.syncing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm font-extrabold text-sage-700 shadow-sm active:bg-sage-100 disabled:opacity-50"
            >
              <RefreshCw className={'h-4 w-4 ' + (strava.syncing ? 'animate-spin' : '')} />
              {strava.syncing ? 'Synchronisation…' : 'Synchroniser mes courses'}
            </button>
            <p className="mt-2 text-center text-xs font-semibold text-ink-soft">
              {strava.message ?? (formatLastSync(strava.lastSync) ? `Dernière synchro : ${formatLastSync(strava.lastSync)}` : 'Importe tes sorties COROS via Strava')}
            </p>
          </div>
        )}

        <section className="rounded-2xl bg-sage-50 p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
            <Bug className="h-3.5 w-3.5" /> Bugs & idées d'amélioration
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitIdea()
              }}
              placeholder="Noter un bug ou une idée…"
              className="min-w-0 flex-1 rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-ink-soft/60 focus:border-sage-400"
            />
            {ideaText.trim() && (
              <button
                type="button"
                onClick={() => void submitIdea()}
                className="shrink-0 rounded-full bg-sage-500 px-3.5 py-2 text-xs font-extrabold text-white active:bg-sage-600"
              >
                + Noter
              </button>
            )}
          </div>
          {ideas.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {ideas.map((i) => (
                <div key={i.id} className="flex items-start gap-2 rounded-xl bg-surface px-3 py-2">
                  <button
                    type="button"
                    aria-label={i.done ? 'Marquer à faire' : 'Marquer réglée'}
                    onClick={() => void updateIdea(i.id, { done: !i.done })}
                    className={
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ' +
                      (i.done ? 'bg-sage-500 text-white' : 'border-2 border-sand text-transparent')
                    }
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </button>
                  <p
                    className={
                      'min-w-0 flex-1 text-sm font-semibold ' + (i.done ? 'text-ink-soft line-through' : 'text-ink')
                    }
                  >
                    {i.text}
                  </p>
                  <button
                    type="button"
                    aria-label="Supprimer la note"
                    onClick={() => void removeIdea(i.id)}
                    className="shrink-0 px-1 text-ink-soft/50 active:text-hiit"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <GhostButton onClick={() => void doExport()}>
          <span className="flex items-center justify-center gap-2">
            <Download className="h-4 w-4" /> Exporter mes données (JSON)
          </span>
        </GhostButton>
        <GhostButton onClick={() => fileRef.current?.click()}>
          <span className="flex items-center justify-center gap-2">
            <Upload className="h-4 w-4" /> Importer une sauvegarde
          </span>
        </GhostButton>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void doImport(f)
            e.target.value = ''
          }}
        />

        {mode === 'cloud' && (
          <GhostButton danger onClick={() => void signOut()}>
            Se déconnecter
          </GhostButton>
        )}

        <p className="pt-2 text-center text-xs text-ink-soft/60">Élan v1.0 — fait avec 🌿</p>
      </div>
    </Sheet>
  )
}
