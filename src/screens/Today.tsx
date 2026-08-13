import { useLiveQuery } from 'dexie-react-hooks'
import { WeekStrip } from '../components/WeekStrip'
import { fi } from '../i18n'
import { fullDate } from '../lib/format'
import { useProfile } from '../lib/settings'
import { listMovements } from '../lib/movements'
import { weekOf } from '../lib/week'

interface Props {
  onOpenDay: (at: number) => void
  onOpenSettings: () => void
}

/**
 * The landing screen is a greeting and the week, and nothing else.
 *
 * Starting a session lives in the app's bottom action bar; the routine list and
 * the empty start live in the day view. What was here before — a Seuraava card,
 * a resume banner, a way-in row, and seven routine rows — came to 1.84 screens
 * and 16 controls to answer "what now".
 */
export function Today({ onOpenDay, onOpenSettings }: Props) {
  const profile = useProfile()

  const data = useLiveQuery(async () => ({
    week: await weekOf(Date.now()),
    // Loaded so the week glyph can resolve muscles; never rendered as a list.
    movements: await listMovements(),
  }))

  if (!data) return <p className="blank note">{fi.loading}</p>

  return (
    <>
      {/* No masthead here. Liikekirjasto lives in the tab bar, so repeating it
          was a duplicate, and a sticky bar holding one icon is not worth 44px. */}
      <div className="appbar">
        <button
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label={fi.settings}
          title={fi.settings}
        >
          <SlidersIcon />
        </button>
      </div>

      {/* The greeting sits in the content, and is also the way into today's
          detail — the largest thing on screen is a target, not a label. */}
      <button className="greeting" onClick={() => onOpenDay(Date.now())}>
        <span className="grow">
          <span className="t-title">{fi.greeting(Date.now(), profile.name)}</span>
          <span className="t-data">{fullDate(Date.now())}</span>
        </span>
        <span className="t-data">→</span>
      </button>

      <WeekStrip week={data.week} onOpenDay={onOpenDay} />
    </>
  )
}

/** Sliders rather than a gear: three strokes and three knobs stay crisp at 20px,
 *  where a gear's teeth turn to mush. */
function SlidersIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <g
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        <circle cx="13" cy="5.5" r="2.1" fill="var(--ground)" />
        <circle cx="7" cy="10" r="2.1" fill="var(--ground)" />
        <circle cx="14.5" cy="14.5" r="2.1" fill="var(--ground)" />
      </g>
    </svg>
  )
}
