import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { fi } from '../i18n'
import { durationOrDash, localDay, shortDate, weekdayName } from '../lib/format'
import { completedSetCount, volumeKg } from '../lib/session'

/**
 * One day: what was trained, and one way to add to it.
 *
 * The routine list used to live here, which made this view answer two questions
 * at once. Choosing what to train moved to RoutinePicker, leaving this as a
 * record with a single action.
 */
export function Day({
  at,
  onBack,
  onAddWorkout,
  onOpenSummary,
}: {
  at: number
  onBack: () => void
  onAddWorkout: () => void
  onOpenSummary: (id: string) => void
}) {
  const day = localDay(at)
  const isToday = day === localDay(Date.now())
  const isFuture = day > localDay(Date.now())

  const sessions = useLiveQuery(
    async () =>
      (await db.sessions.toArray())
        .filter((s) => s.startedLocalDay === day && s.finishedAt !== null)
        .sort((a, b) => a.startedAt - b.startedAt),
    [day],
  )

  if (!sessions) return <p className="blank note">{fi.loading}</p>

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
          {sessions.length > 0 && ` · ${fi.sessionCount(sessions.length)}`}
        </span>
      </header>

      {/* No "ei treeniä" line: the start row below already says the day is open,
          and stating the absence first only delays reading the one action. */}
      {sessions.length > 0 && (
        <ul className="ledger">
          {sessions.map((s) => (
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

      {/* Any day that has happened can take a workout; only the future cannot. */}
      {!isFuture && (
        <button className="entry start-row" onClick={onAddWorkout}>
          <span className="start-mark" aria-hidden="true">
            +
          </span>
          <span className="grow">
            <span className="t-name">{isToday ? fi.startWorkout : fi.addWorkout}</span>
            <span className="t-data">{fi.chooseFromRoutines}</span>
          </span>
          <span className="t-data">→</span>
        </button>
      )}
    </>
  )
}
