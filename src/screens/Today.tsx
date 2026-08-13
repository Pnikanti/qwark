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
import { currentRotation, rotations, type Rotation } from '../lib/rotation'
import type { EffectiveMovement, Template } from '../types'

interface Props {
  onOpenSession: (id: string) => void
  onOpenLibrary: () => void
  onOpenSettings: () => void
  onOpenSummary: (id: string) => void
}

export function Today({
  onOpenSession,
  onOpenLibrary,
  onOpenSettings,
  onOpenSummary,
}: Props) {
  const data = useLiveQuery(async () => ({
    active: await activeSession(),
    templates: await listTemplates(),
    history: await finishedSessions(3),
    movements: await listMovements(),
    rotations: await rotations(),
    current: await currentRotation(),
  }))

  if (!data) return <p className="blank note">{fi.loading}</p>

  const byId = new Map(data.movements.map((m) => [m.id, m]))
  const name = (id: string) => byId.get(id)?.nameFi ?? byId.get(id)?.nameEn ?? id
  const firstRun = data.history.length === 0 && !data.active

  const begin = async (template?: Template) => onOpenSession(await startSession(template))

  const groups = new Map<string, Template[]>()
  for (const t of [...data.templates].sort((a, b) => a.order - b.order)) {
    const key = t.group ?? fi.yourRoutines
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  // When each routine was last done is useful everywhere. The "next" marker is
  // not: every group has one, and marking them all makes the accent mean nothing,
  // so only the cycle you are part-way through carries it.
  const lastDone = new Map(
    data.rotations.flatMap((r) => r.entries.map((e) => [e.template.id, e.lastDoneAt])),
  )
  const nextId = data.current?.next.id ?? null

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
          <button className="btn" onClick={onOpenSettings}>
            {fi.settings}
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

      {/* Derived from which routine you finished last — no calendar involved. */}
      {data.current && !data.active && (
        <NextUp rotation={data.current} onStart={() => begin(data.current!.next)} />
      )}

      <div className="panel">
        {firstRun && <p className="note">{fi.firstRunHint}</p>}
        <div className="row-actions">
          {/* Secondary once the cycle has an answer — two primary buttons in a
              row would compete for the same tap. */}
          <button
            className={`btn btn-tall${data.current && !data.active ? '' : ' solid'}`}
            onClick={() => begin()}
          >
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
                  entry={{
                    lastDoneAt: lastDone.get(t.id) ?? null,
                    isNext: t.id === nextId,
                  }}
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

/** What to train next, and where that sits in the cycle. */
function NextUp({
  rotation,
  onStart,
}: {
  rotation: Rotation
  onStart: () => void
}) {
  return (
    <div className="nextup">
      <span className="t-data nextup-tag">{fi.nextUp}</span>
      <div className="nextup-row">
        <span className="grow">
          <span className="t-name">{rotation.next.name}</span>
          <span className="t-data">
            {rotation.group} · {rotation.position}/{rotation.length}
          </span>
        </span>
        <button className="btn solid" onClick={onStart}>
          {fi.start}
        </button>
      </div>
    </div>
  )
}

function RoutineRow({
  template,
  movements,
  label,
  entry,
  onStart,
}: {
  template: Template
  movements: Map<string, EffectiveMovement>
  label: string
  entry: { lastDoneAt: number | null; isNext: boolean } | undefined
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
    <div className={`entry routine${entry?.isNext ? ' is-next' : ''}`}>
      <BodyPlan primary={primary} secondary={secondary} size={42} view="both" />
      <span className="grow">
        <span className="t-name">
          {template.name}
          {entry?.isNext && <span className="cycle-mark"> {fi.nextInCycle}</span>}
        </span>
        <span className="t-data">
          {entry?.lastDoneAt
            ? fi.lastDone(shortDate(entry.lastDoneAt))
            : `${template.items.length} ${fi.movementWord(template.items.length)} · ${fi.setCount(totalSets)}`}
        </span>
        <span className="t-data routine-detail">{label}</span>
      </span>
      <button className="btn" onClick={onStart}>
        {fi.start}
      </button>
    </div>
  )
}
