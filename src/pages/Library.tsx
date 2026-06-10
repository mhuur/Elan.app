import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META } from '../types'
import { DAY_SHORT } from '../lib/dates'
import { summarizeSession } from '../lib/format'
import { EmptyState, Fab, PageHeader, Seg } from '../components/ui'

export default function Library() {
  const { sessions, exercises } = useData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab: 'seances' | 'exos' = params.get('tab') === 'exos' ? 'exos' : 'seances'

  return (
    <div>
      <PageHeader kicker="Bibliothèque" title="Exercices & séances" />
      <div className="px-5 pb-4">
        <Seg
          options={[
            { value: 'seances' as const, label: 'Séances' },
            { value: 'exos' as const, label: 'Exercices' },
          ]}
          value={tab}
          onChange={(v) => setParams(v === 'exos' ? { tab: 'exos' } : {})}
        />
      </div>

      {tab === 'seances' ? (
        <div className="space-y-4 px-5">
          {CATEGORIES.map((cat) => {
            const list = sessions.filter((s) => s.category === cat)
            if (!list.length) return null
            const meta = CATEGORY_META[cat]
            return (
              <section key={cat}>
                <h2 className={`mb-2 text-[11px] font-extrabold uppercase tracking-wider ${meta.text}`}>
                  {meta.emoji} {meta.label}
                </h2>
                <div className="space-y-2">
                  {list.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => navigate(`/session/${s.id}`)}
                      className="flex w-full items-center gap-3 rounded-3xl bg-surface p-4 text-left shadow-sm active:scale-[0.985]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">{s.name}</p>
                        <p className="truncate text-xs font-semibold text-ink-soft">{summarizeSession(s)}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-sage-50 px-2.5 py-1 text-[10px] font-extrabold text-sage-600">
                        {s.days.length ? s.days.map((d) => DAY_SHORT[d]).join(' · ') : 'Non planifiée'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
          {sessions.length === 0 && <EmptyState emoji="🗂️" text="Aucune séance. Créez-en une avec le bouton ci-dessous !" />}
        </div>
      ) : (
        <div className="space-y-4 px-5">
          {CATEGORIES.map((cat) => {
            const list = exercises.filter((e) => e.category === cat)
            if (!list.length) return null
            const meta = CATEGORY_META[cat]
            return (
              <section key={cat}>
                <h2 className={`mb-2 text-[11px] font-extrabold uppercase tracking-wider ${meta.text}`}>
                  {meta.emoji} {meta.label}
                </h2>
                <div className="overflow-hidden rounded-3xl bg-surface shadow-sm">
                  {list.map((e, i) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => navigate(`/exercise/${e.id}`)}
                      className={
                        'flex w-full items-center gap-2 px-4 py-3 text-left active:bg-sage-50 ' +
                        (i > 0 ? 'border-t border-cream' : '')
                      }
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{e.name}</span>
                      {e.measure === 'sec' && (
                        <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[10px] font-extrabold text-ink-soft">
                          secondes
                        </span>
                      )}
                      {e.videoUrl && (
                        <a
                          href={e.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(ev) => ev.stopPropagation()}
                          className="shrink-0 rounded-full bg-velo/10 px-2.5 py-1 text-xs font-extrabold text-velo"
                        >
                          ▶ démo
                        </a>
                      )}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-sage-300">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
          {exercises.length === 0 && <EmptyState emoji="💪" text="Aucun exercice. Créez-en un avec le bouton ci-dessous !" />}
        </div>
      )}

      <Fab
        label={tab === 'seances' ? '+ Séance' : '+ Exercice'}
        onClick={() => navigate(tab === 'seances' ? '/session/new' : '/exercise/new')}
      />
    </div>
  )
}
