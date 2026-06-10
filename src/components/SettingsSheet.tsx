import { useRef } from 'react'
import { useData } from '../data/DataContext'
import { todayStr } from '../lib/dates'
import type { StoreData } from '../data/store'
import { GhostButton, Sheet } from './ui'

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode, user, signOut, exportAll, importAll } = useData()
  const fileRef = useRef<HTMLInputElement>(null)

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
          <div className="rounded-2xl bg-sage-50 p-4 text-sm font-semibold text-ink-soft">
            ☁️ Connecté en tant que <span className="text-ink">{user?.email}</span>
            <br />
            Vos données sont synchronisées sur tous vos appareils.
          </div>
        ) : (
          <div className="rounded-2xl bg-sage-50 p-4 text-sm font-semibold text-ink-soft">
            📱 <span className="text-ink">Mode local</span> : vos données restent sur cet appareil.
            <br />
            Pour les synchroniser entre téléphone et ordinateur, configurez Firebase (guide dans le fichier README du
            projet), ou utilisez l'export/import ci-dessous.
          </div>
        )}

        <GhostButton onClick={() => void doExport()}>💾 Exporter mes données (JSON)</GhostButton>
        <GhostButton onClick={() => fileRef.current?.click()}>📥 Importer une sauvegarde</GhostButton>
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
