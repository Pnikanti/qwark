import { useLiveQuery } from 'dexie-react-hooks'
import { RoutineList } from '../components/RoutineList'
import { db } from '../db'
import { fi } from '../i18n'
import { durationOrDash, localDay, shortDate, weekdayName } from '../lib/format'
import { listMovements } from '../lib/movements'
import { currentRotation, rotations } from '../lib/rotation'
import { completedSetCount, listTemplates, startSession, volumeKg } from '../lib/session'
import type { Template } from '../types'

/**
 * One day: what was trained, and — when it is today — what there is to start.
 *
 * The landing screen shows the week; the detail lives here. Keeping the routine
 * list off the landing is the point of the split.
 */
export function Day({
  at,
  onBack,
  onOpenSession,
  onOpenSummary,
}: {
  at: number
  onBack: () => void
  onOpenSession: (id: string) => void
  onOpenSummary: (id: string) => void
}) {
  const day = localDay(at)
  const isToday = day === localDay(Date.now())
  const isFuture = day > localDay(Date.now())

  const data = useLiveQuery(
    async () => ({
      sessions: (await db.sessions.toArray())
        .filter((s) => s.startedLocalDay === day && s.finishedAt !== null)
        .sort((a, b) => a.startedAt - b.startedAt),
      templates: await listTemplates(),
      movements: await listMovements(),
      rotations: await rotations(),
      current: await currentRotation(),
    }),
    [day],
  )

  if (!data) return <p className="blank note">{fi.loading}</p>

  const byId = new Map(data.movements.map((m) => [m.id, m]))
  const lastDone = new Map(
    data.rotations.flatMap((r) => r.entries.map((e) => [e.template.id, e.lastDoneAt])),
  )
  const nextId = data.current?.next.id ?? null

  // Sessions added to a past day are dated to that day, not to now.
  const begin = async (template?: Template) =>
    onOpenSession(await startSession(template, at))

  const date = new Date(at)

  return (
    <>
      <header className="masthead">
        <button className="back" onClick={onBack}>
          ← {fi.back}
        </button>
        <h1 className="t-title">{isToday ? fi.today : weekdayName(at)}</h1>
        <span className="t-data">
          {date.getDate()}.{date.getMonth() + 1}.{date.getFullYear()}
          {data.sessions.length > 0 && ` · ${fi.sessionCount(data.sessions.length)}`}
        </span>
      </header>

      {/* Only a past day needs telling. On today the start rows follow, so the
          message would just be a gap above them. */}
      {data.sessions.length === 0 ? (
        !isToday && (
          <div className="blank">
            <span className="t-data">{fi.noTrainingThatDay}</span>
          </div>
        )
      ) : (
        <ul className="ledger">
          {data.sessions.map((s) => (
            <li key={s.id}>
              <button className="entry" onClick={() => onOpenSummary(s.id)}>
                <span className="grow">
                  <span className="t-name">{s.templateName ?? fi.startEmpty}</span>
                  <span className="t-data">
                    {shortDate(s.startedAt)} · {fi.setCount(completedSetCount(s))}
                    {volumeKg(s) > 0 && ` · ${volumeKg(s).toLocaleString('fi')} kg`}
                    {s.finishedAt !== null &&
                      ` · ${durationOrDash(s.finishedAt - s.startedAt)}`}
                  </span>
                </span>
                <span className="t-data">→</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Any day that has happened can take a workout — you might have forgotten
          to log one. Only the future cannot. */}
      {!isFuture && (
        <>
          {!isToday && <h2 className="section-mark">{fi.addWorkout}</h2>}
          {/* Same row element as the routines below it — starting from nothing
              is one of the options, not a control floating above them. */}
          <button className="entry start-row" onClick={() => begin()}>
            <span className="start-mark" aria-hidden="true">
              +
            </span>
            <span className="grow">
              <span className="t-name">
                {isToday ? fi.startEmpty : fi.addEmpty}
              </span>
              <span className="t-data">{fi.startEmptyHint}</span>
            </span>
            <span className="t-data">→</span>
          </button>
          <RoutineList
            templates={data.templates}
            movements={byId}
            meta={(id) => ({
              lastDoneAt: lastDone.get(id) ?? null,
              isNext: id === nextId,
            })}
            onStart={begin}
            startLabel={isToday ? fi.start : fi.add}
          />
        </>
      )}
    </>
  )
}
