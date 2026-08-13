import { useLiveQuery } from 'dexie-react-hooks'
import { WeekStrip } from '../components/WeekStrip'
import { fi } from '../i18n'
import { fullDate, relativeAge } from '../lib/format'
import { listMovements } from '../lib/movements'
import { currentRotation, type Rotation } from '../lib/rotation'
import { activeSession, completedSetCount, startSession } from '../lib/session'
import { weekOf } from '../lib/week'
import type { Template } from '../types'

interface Props {
  onOpenSession: (id: string) => void
  onOpenDay: (at: number) => void
  onOpenLibrary: () => void
  onOpenSettings: () => void
}

/**
 * The landing screen: the week, and the one thing there is to do next.
 *
 * The routine list used to live here — seven rows, 732px, 47% of the page,
 * mostly restating what the Seuraava card says. It moved to the day view. The
 * Seuraava card stays, because starting today's session should be one tap.
 */
export function Today({
  onOpenSession,
  onOpenDay,
  onOpenLibrary,
  onOpenSettings,
}: Props) {
  const data = useLiveQuery(async () => ({
    active: await activeSession(),
    current: await currentRotation(),
    week: await weekOf(Date.now()),
    // Loaded so the week glyph can resolve muscles; never rendered as a list.
    movements: await listMovements(),
  }))

  if (!data) return <p className="blank note">{fi.loading}</p>

  const begin = async (template?: Template) =>
    onOpenSession(await startSession(template))

  return (
    <>
      <header className="masthead">
        <h1 className="t-title">{fi.today}</h1>
        <span className="t-data">{fullDate(Date.now())}</span>
        <div className="masthead-actions">
          <button className="btn" onClick={onOpenLibrary}>
            {fi.library}
          </button>
          <button className="btn" onClick={onOpenSettings}>
            {fi.settings}
          </button>
        </div>
      </header>

      {/* An unfinished session overrides everything else. */}
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

      <WeekStrip week={data.week} onOpenDay={onOpenDay} />

      {data.current && !data.active && (
        <NextUp rotation={data.current} onStart={() => begin(data.current!.next)} />
      )}

      {/* The way into routines and everything else about today. */}
      <button className="entry start-row" onClick={() => onOpenDay(Date.now())}>
        <span className="start-mark" aria-hidden="true">
          ▸
        </span>
        <span className="grow">
          <span className="t-name">{fi.openToday}</span>
          <span className="t-data">
            {data.current ? fi.openTodayHint : fi.firstRunHint}
          </span>
        </span>
        <span className="t-data">→</span>
      </button>
    </>
  )
}

/** What to train next, and where that sits in the cycle. */
function NextUp({ rotation, onStart }: { rotation: Rotation; onStart: () => void }) {
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
