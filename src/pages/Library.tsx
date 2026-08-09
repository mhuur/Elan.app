import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META, PRESET_SUBTYPES, subtypesOf, type Exercise } from '../types'
import { Play, Plus } from 'lucide-react'
import { summarizeSession } from '../lib/format'
import { describeSchedule } from '../lib/schedule'
import { CategoryIcon, EmptyState, Fab, PageHeader, Seg, glassCard } from '../components/ui'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Groupes de sous-types (un exercice multi-tags apparaît dans chacun) : presets dans l'ordre, customs ensuite, « sans » à la fin */
function subtypeGroups(list: Exercise[]): [string, Exercise[]][] {
  const map = new Map<string, Exercise[]>()
  for (const e of list) {
    const sts = subtypesOf(e)
    for (const k of sts.length ? sts : ['']) {
      const arr = map.get(k)
      if (arr) arr.push(e)
      else map.set(k, [e])
    }
  }
  const rank = (k: string) => {
    if (!k) return 10000
    const i = PRESET_SUBTYPES.indexOf(k)
    return i === -1 ? 5000 : i
  }
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'fr'))
}

export default function Library() {
  const { sessions, exercises } = useData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab: 'seances' | 'exos' = params.get('tab') === 'exos' ? 'exos' : 'seances'
  const [query, setQuery] = useState('')

  const visibleExercises = exercises.filter(
    (e) =>
      !query.trim() ||
      norm(e.name).includes(norm(query)) ||
      subtypesOf(e).some((st) => norm(st).includes(norm(query))),
  )

  return (
    <div>
      <PageHeader kicker="Bibliothèque de bord" title="Exercices & séances" />
      <div className="px-5 pb-4">
        <Seg
          options={[
            { value: 'seances' as const, label: 'Mes séances' },
            { value: 'exos' as const, label: "Banque d'exercices" },
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
                <h2 className={`mb-1.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase ${meta.text}`}>
                  <CategoryIcon category={cat} className="h-3.5 w-3.5" /> — {meta.label}
                </h2>
                {/* Lignes séparées par un filet, sans carte : la maquette laisse la photo
                    respirer entre les sections plutôt que d'empiler des pavés. */}
                <div>
                  {list.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => navigate(`/session/${s.id}`)}
                      className={
                        'flex w-full items-center gap-2.5 py-2.5 text-left ' +
                        (i < list.length - 1 ? 'border-b border-hairline' : '')
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[21px] leading-none font-bold uppercase">{s.name}</p>
                        <p className="mt-1 truncate font-mono text-[9px] tracking-[0.1em] uppercase text-ink/60">
                          {summarizeSession(s)}
                        </p>
                      </div>
                      <span className="max-w-36 shrink-0 truncate rounded-full border border-hairline-strong px-2.5 py-[3px] font-mono text-[9px] tracking-[0.1em] uppercase text-ink/70">
                        {describeSchedule(s, sessions)}
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
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un exercice ou un sous-type…"
            className="w-full rounded-sm border border-hairline bg-glass-sunken px-4 py-3 text-sm font-semibold outline-none backdrop-blur-lg placeholder:font-normal placeholder:text-ink/40 focus:border-sage-500"
          />
          {CATEGORIES.map((cat) => {
            const list = visibleExercises.filter((e) => e.category === cat)
            if (!list.length) return null
            const meta = CATEGORY_META[cat]
            return (
              <section key={cat}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className={`flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase ${meta.text}`}>
                    <CategoryIcon category={cat} className="h-3.5 w-3.5" /> — {meta.label}
                  </h2>
                  <button
                    type="button"
                    aria-label={`Nouvel exercice ${meta.label}`}
                    onClick={() => navigate(`/exercise/new?cat=${cat}`)}
                    className="flex h-6 w-6 items-center justify-center rounded-xs border border-hairline-strong text-ink/70 active:bg-glass"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {subtypeGroups(list).map(([subtype, exos]) => (
                    <div key={subtype || '—'}>
                      {subtype && (
                        <div className="mb-1 flex items-center justify-between px-1">
                          <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink/50">{subtype}</p>
                          <button
                            type="button"
                            aria-label={`Nouvel exercice ${subtype}`}
                            onClick={() => navigate(`/exercise/new?cat=${cat}&st=${encodeURIComponent(subtype)}`)}
                            className="flex h-5 w-5 items-center justify-center rounded-xs border border-hairline text-ink/60 active:bg-glass"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <div className={'overflow-hidden ' + glassCard}>
                        {exos.map((e, i) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => navigate(`/exercise/${e.id}`)}
                            className={
                              'flex w-full items-center gap-2 px-3.5 py-2.5 text-left active:bg-glass-raised ' +
                              (i > 0 ? 'border-t border-hairline' : '')
                            }
                          >
                            <span className="min-w-0 flex-1 truncate font-display text-lg leading-none font-bold uppercase">
                              {e.name}
                            </span>
                            {e.measure === 'sec' && (
                              <span className="shrink-0 rounded-full border border-hairline px-2 py-[3px] font-mono text-[8px] tracking-[0.1em] uppercase text-ink/60">
                                sec
                              </span>
                            )}
                            {e.videoUrl && (
                              <a
                                href={e.videoUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(ev) => ev.stopPropagation()}
                                className="flex shrink-0 items-center gap-1 rounded-full border border-velo/40 px-2 py-[3px] font-mono text-[8px] tracking-[0.1em] uppercase text-velo"
                              >
                                <Play className="h-2.5 w-2.5" /> démo
                              </a>
                            )}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-sage-500">
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
          {exercises.length === 0 && <EmptyState emoji="💪" text="Aucun exercice. Créez-en un avec le bouton ci-dessous !" />}
          {exercises.length > 0 && visibleExercises.length === 0 && (
            <EmptyState emoji="🔍" text={`Aucun exercice ne correspond à « ${query} ».`} />
          )}
        </div>
      )}

      <Fab
        label={tab === 'seances' ? '+ Séance' : '+ Exercice'}
        onClick={() => navigate(tab === 'seances' ? '/session/new' : '/exercise/new')}
      />
    </div>
  )
}
