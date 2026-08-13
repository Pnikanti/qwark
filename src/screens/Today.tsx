import { useLiveQuery } from 'dexie-react-hooks'
import { WeekStrip } from '../components/WeekStrip'
import { fi } from '../i18n'
import { fullDate } from '../lib/format'
import { useProfile } from '../lib/settings'
import { listMovements } from '../lib/movements'
import { weekOf } from '../lib/week'

/**
 * The landing screen is the week, and nothing else.
 *
 * Starting a session lives in the app's bottom action bar; the routine list and
 * the empty start live in the day view. What was here before — a Seuraava card,
 * a resume banner, a way-in row, and seven routine rows — came to 1.84 screens
 * and 16 controls to answer "what now".
 */
export function Today({
  onOpenDay,
  onOpenLibrary,
  onOpenSettings,
}: {
  onOpenDay: (at: number) => void
  onOpenLibrary: () => void
  onOpenSettings: () => void
}) {
  const profile = useProfile()

  const data = useLiveQuery(async () => ({
    week: await weekOf(Date.now()),
    // Loaded so the week glyph can resolve muscles; never rendered as a list.
    movements: await listMovements(),
  }))

  if (!data) return <p className="blank note">{fi.loading}</p>

  return (
    <>
      <header className="masthead">
        {/* The greeting is also the way into today's detail, so the largest
            thing on screen is a target rather than a label. */}
        <button className="greeting" onClick={() => onOpenDay(Date.now())}>
          <span className="grow">
            <span className="t-title">
              {profile.name ? fi.greeting(profile.name) : fi.today}
            </span>
            <span className="t-data">{fullDate(Date.now())}</span>
          </span>
          <span className="t-data">→</span>
        </button>
        <div className="masthead-actions">
          <button className="btn" onClick={onOpenLibrary}>
            {fi.library}
          </button>
          <button className="btn" onClick={onOpenSettings}>
            {fi.settings}
          </button>
        </div>
      </header>

      <WeekStrip week={data.week} onOpenDay={onOpenDay} />
    </>
  )
}
