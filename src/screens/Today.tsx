import { useLiveQuery } from 'dexie-react-hooks'
import { BodyPlan } from '../components/BodyPlan'
import { fi } from '../i18n'
import { listMovements } from '../lib/movements'
import {
  activeSession,
  completedSetCount,
  finishedSessions,
  listTemplates,
  startSession,
  volumeKg,
} from '../lib/session'
import { relativeAge, shortDate } from '../lib/format'
import type { EffectiveMovement, Template } from '../types'

interface Props {
  onOpenSession: (id: string) => void
  onOpenLibrary: () => void
  onOpenSummary: (id: string) => void
}

export function Today({ onOpenSession, onOpenLibrary, onOpenSummary }: Props) {
  const data = useLiveQuery(async () => ({
    active: await activeSession(),
    templates: await listTemplates(),
    history: await finishedSessions(3),
    movements: await listMovements(),
  }))

  if (!data) return <p className="blank note">{fi.loading}</p>

  const byId = new Map(data.movements.map((m) => [m.id, m]))
  const name = (id: string) => byId.get(id)?.nameFi ?? byId.get(id)?.nameEn ?? id
  const firstRun = data.history.length === 0 && !data.active

  const begin = async (template?: Template) => onOpenSession(await startSession(template))

  const groups = new Map<string, Template[]>()
  for (const t of data.templates) {
    const key = t.group ?? fi.yourRoutines
    groups.set(key, [...(groups.get(key) ?? []), t])
  }

  return (
    <>
      <header className="masthead">
        <h1 className="t-title">{fi.today}</h1>
        <span className="t-data">
          {data.history.length
            ? `${fi.lastSession}: ${shortDate(data.history[0].startedAt)}`
            : fi.noHistory}
        </span>
        <div className="masthead-actions">
          <button className="btn" onClick={onOpenLibrary}>
            {fi.library}
          </button>
        </div>
      </header>

      {/* Highest-priority state: an unfinished session overrides everything. */}
      {data.active && (
        <button className="resume" onClick={() => onOpenSession(data.active!.id)}>
          <span className="grow">
            <span className="t-name">{fi.resume}</span>
            <span className="t-data">
              {data.active.templateName ?? fi.startEmpty} ·{' '}
              {fi.startedAgo(relativeAge(data.active.startedAt))} ·{' '}
              {fi.setCount(completedSetCount(data.active))}
            </span>
          </span>
          <span className="t-data">→</span>
        </button>
      )}

      <div className="panel">
        {firstRun && <p className="note">{fi.firstRunHint}</p>}
        <div className="row-actions">
          <button className="btn solid btn-tall" onClick={() => begin()}>
            {fi.startEmpty}
          </button>
        </div>
      </div>

      {[...groups].map(([group, templates]) => (
        <section key={group}>
          <h2 className="section-mark">{group}</h2>
          <ul className="ledger">
            {templates.map((t) => (
              <li key={t.id}>
                <RoutineRow
                  template={t}
                  movements={byId}
                  label={t.items.map((i) => name(i.movementId)).join(' · ')}
                  onStart={() => begin(t)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {data.history.length > 0 && (
        <section>
          <h2 className="section-mark">{fi.lastSession}</h2>
          <ul className="ledger">
            {data.history.map((s) => (
              <li key={s.id}>
                <button className="entry" onClick={() => onOpenSummary(s.id)}>
                  <span className="grow">
                    <span className="t-name">{s.templateName ?? fi.startEmpty}</span>
                    <span className="t-data">
                      {shortDate(s.startedAt)} · {fi.setCount(completedSetCount(s))} ·{' '}
                      {volumeKg(s).toLocaleString('fi')} kg
                    </span>
                  </span>
                  <span className="t-data">→</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function RoutineRow({
  template,
  movements,
  label,
  onStart,
}: {
  template: Template
  movements: Map<string, EffectiveMovement>
  label: string
  onStart: () => void
}) {
  const primary = template.items.flatMap(
    (i) => movements.get(i.movementId)?.primaryMuscles ?? [],
  )
  const secondary = template.items.flatMap(
    (i) => movements.get(i.movementId)?.secondaryMuscles ?? [],
  )
  const totalSets = template.items.reduce((n, i) => n + i.sets, 0)

  return (
    <div className="entry routine">
      <BodyPlan primary={primary} secondary={secondary} size={42} view="both" />
      <span className="grow">
        <span className="t-name">{template.name}</span>
        <span className="t-data">
          {template.items.length} {fi.movementWord(template.items.length)} ·{' '}
          {fi.setCount(totalSets)}
        </span>
        <span className="t-data routine-detail">{label}</span>
      </span>
      <button className="btn" onClick={onStart}>
        {fi.start}
      </button>
    </div>
  )
}
