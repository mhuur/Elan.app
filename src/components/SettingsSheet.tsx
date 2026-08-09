import { useRef, useState } from 'react'
import { Bell, BellOff, Bug, Check, Cloud, Download, Plus, RefreshCw, Smartphone, Upload, X } from 'lucide-react'
import { useData } from '../data/DataContext'
import { todayStr } from '../lib/dates'
import { usePushReminders } from '../lib/usePushReminders'
import { formatLastSync, useStravaSync } from '../lib/useStravaSync'
import type { StoreData } from '../data/store'
import { GhostButton, Sheet } from './ui'

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode, user, signOut, exportAll, importAll, ideas, addIdea, updateIdea, removeIdea } = useData()
  const strava = useStravaSync()
  const rappels = usePushReminders()
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
    a.download = `avel-sauvegarde-${todayStr()}.json`
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
          <div className="flex items-start gap-2.5 rounded-sm bg-sage-50 p-4 text-sm font-semibold text-ink-soft">
            <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" />
            <span>
              Connecté en tant que <span className="text-ink">{user?.email}</span>
              <br />
              Vos données sont synchronisées sur tous vos appareils.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-sm bg-sage-50 p-4 text-sm font-semibold text-ink-soft">
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
          <div className="rounded-sm bg-sage-50 p-4">
            <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
              <RefreshCw className="h-3.5 w-3.5" /> Courses Strava
            </h3>
            <button
              type="button"
              onClick={() => void strava.sync()}
              disabled={strava.syncing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-shoal px-4 py-2.5 text-sm font-extrabold text-sage-700 shadow-sm active:bg-sage-100 disabled:opacity-50"
            >
              <RefreshCw className={'h-4 w-4 ' + (strava.syncing ? 'animate-spin' : '')} />
              {strava.syncing ? 'Synchronisation…' : 'Synchroniser mes courses'}
            </button>
            <p className="mt-2 text-center text-xs font-semibold text-ink-soft">
              {strava.message ?? (formatLastSync(strava.lastSync) ? `Dernière synchro : ${formatLastSync(strava.lastSync)}` : 'Importe tes sorties COROS via Strava')}
            </p>
          </div>
        )}

        {rappels.configured && (
          <div className="rounded-sm bg-sage-50 p-4">
            <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
              <Bell className="h-3.5 w-3.5" /> Rappels de séance
            </h3>
            {rappels.supported ? (
              <>
                <button
                  type="button"
                  onClick={() => void (rappels.enabled ? rappels.disable() : rappels.enable())}
                  disabled={rappels.busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-shoal px-4 py-2.5 text-sm font-extrabold text-sage-700 shadow-sm active:bg-sage-100 disabled:opacity-50"
                >
                  {rappels.enabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  {rappels.enabled ? 'Désactiver les rappels' : 'Activer les rappels'}
                </button>

                {rappels.enabled && (
                  <div className="mt-2 space-y-1.5">
                    {rappels.hours.map((h, i) => (
                      // Clé positionnelle : `key={h}` remonterait l'input à chaque frappe (la
                      // valeur change), lui faisant perdre le focus en pleine saisie.
                      <div key={i} className="flex items-center gap-2 rounded-xl bg-shoal px-4 py-2.5 shadow-sm">
                        <span className="flex-1 text-sm font-extrabold text-ink">
                          {i === 0 ? 'Rappel du jour à' : 'Puis relance à'}
                        </span>
                        <input
                          type="time"
                          aria-label={`Heure du rappel ${i + 1}`}
                          value={h}
                          onChange={(e) => void rappels.setHour(i, e.target.value)}
                          disabled={rappels.busy}
                          className="rounded-lg border border-sand bg-shoal px-2 py-1 text-sm font-extrabold text-ink outline-none focus:border-sage-400 disabled:opacity-50"
                        />
                        {rappels.hours.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Supprimer le rappel de ${h}`}
                            onClick={() => void rappels.removeHour(i)}
                            disabled={rappels.busy}
                            className="shrink-0 rounded-lg p-1 text-ink-soft active:bg-sage-100 disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    {rappels.canAdd && (
                      <button
                        type="button"
                        onClick={() => void rappels.addHour()}
                        disabled={rappels.busy}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-shoal px-4 py-2.5 text-sm font-extrabold text-sage-700 shadow-sm active:bg-sage-100 disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" /> Ajouter un rappel
                      </button>
                    )}
                  </div>
                )}

                <p className="mt-2 text-center text-xs font-semibold text-ink-soft">
                  {rappels.message ??
                    (rappels.enabled
                      ? 'Rien les jours de repos, ni si la séance est déjà validée'
                      : 'Reçois ta séance du jour en notification')}
                </p>

                {rappels.enabled && (
                  <button
                    type="button"
                    onClick={() => void rappels.sendTest()}
                    disabled={rappels.busy}
                    className="mt-1 w-full text-center text-xs font-extrabold text-sage-700 underline underline-offset-2 disabled:opacity-50"
                  >
                    Envoyer une notification de test
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs font-semibold text-ink-soft">
                Ce navigateur ne gère pas les notifications. Installe Avel sur ton écran d'accueil depuis Chrome.
              </p>
            )}
          </div>
        )}

        <section className="rounded-sm bg-sage-50 p-4">
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
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
              className="min-w-0 flex-1 rounded-xl border border-sand bg-shoal px-3 py-2.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-ink-soft/60 focus:border-sage-400"
            />
            {ideaText.trim() && (
              <button
                type="button"
                onClick={() => void submitIdea()}
                className="shrink-0 rounded-full bg-sage-500 px-3.5 py-2 text-xs font-extrabold text-onaccent active:bg-sage-600"
              >
                + Noter
              </button>
            )}
          </div>
          {ideas.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {ideas.map((i) => (
                <div key={i.id} className="flex items-start gap-2 rounded-xl bg-shoal px-3 py-2">
                  <button
                    type="button"
                    aria-label={i.done ? 'Marquer à faire' : 'Marquer réglée'}
                    onClick={() => void updateIdea(i.id, { done: !i.done })}
                    className={
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ' +
                      (i.done ? 'bg-sage-500 text-onaccent' : 'border-2 border-sand text-transparent')
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

        <p className="pt-2 text-center text-xs text-ink-soft/60">Avel v1.0 — fait avec 💨</p>
      </div>
    </Sheet>
  )
}
