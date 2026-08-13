import { useLiveQuery } from 'dexie-react-hooks'
import { RoutineList } from '../components/RoutineList'
import { fi } from '../i18n'
import { localDay, weekdayName } from '../lib/format'
import { listMovements } from '../lib/movements'
import { currentRotation, rotations } from '../lib/rotation'
import { listTemplates, startSession } from '../lib/session'
import type { Template } from '../types'

/**
 * Choosing what to train. Reached from the day view's single action, or from
 * `Muut ▸` in the action bar.
 *
 * The routine list used to sit in the day view, which made that view answer two
 * questions at once — what happened, and what to do. This screen answers only
 * the second, and the day view is left as a record with one way forward.
 *
 * Starting from nothing sits at the foot of the list, the same place the movement
 * picker keeps "create your own": you came here to choose, so the escape hatch
 * goes last.
 */
export function RoutinePicker({
  at,
  onBack,
  onStarted,
}: {
  /** The day the session will be logged against. */
  at: number
  onBack: () => void
  onStarted: (sessionId: string) => void
}) {
  const isToday = localDay(at) === localDay(Date.now())

  const data = useLiveQuery(async () => ({
    templates: await listTemplates(),
    movements: await listMovements(),
    rotations: await rotations(),
    current: await currentRotation(),
  }))

  if (!data) return <p className="blank note">{fi.loading}</p>

  const byId = new Map(data.movements.map((m) => [m.id, m]))
  const lastDone = new Map(
    data.rotations.flatMap((r) => r.entries.map((e) => [e.template.id, e.lastDoneAt])),
  )
  const nextId = data.current?.next.id ?? null

  const begin = async (template?: Template) =>
    onStarted(await startSession(template, at))

  return (
    <>
      <header className="masthead">
        <button className="back" onClick={onBack}>
          ← {fi.back}
        </button>
        <h1 className="t-title">{isToday ? fi.chooseWorkout : fi.addWorkout}</h1>
        <span className="t-data">
          {isToday ? fi.today : weekdayName(at)} · {new Date(at).getDate()}.
          {new Date(at).getMonth() + 1}.
        </span>
      </header>

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

      <button className="entry start-row" onClick={() => begin()}>
        <span className="start-mark" aria-hidden="true">
          +
        </span>
        <span className="grow">
          <span className="t-name">{isToday ? fi.startEmpty : fi.addEmpty}</span>
          <span className="t-data">{fi.startEmptyHint}</span>
        </span>
        <span className="t-data">→</span>
      </button>
    </>
  )
}
