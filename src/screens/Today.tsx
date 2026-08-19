import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NoticeSheet, NoticeStrip } from '../components/EarlyNotice'
import { TodayHero } from '../components/TodayHero'
import { WeekStrip } from '../components/WeekStrip'
import { fi } from '../i18n'
import { listMovements } from '../lib/movements'
import { NOTICE_VERSION, dismissNotice, useNoticeSeen } from '../lib/notice'
import { weekOf } from '../lib/week'

interface Props {
  onOpenSession: (id: string) => void
  onOpenDay: (at: number) => void
  onPick: () => void
  onOpenSettings: () => void
}

/**
 * Landing: a hero answering "what today could be", with the week below it as
 * support. The hero owns the first screen; the week is meant to be scrolled to.
 * Trying to fit both above the fold is what produced the cramped-then-empty
 * layout this replaces.
 */
export function Today({ onOpenSession, onOpenDay, onPick, onOpenSettings }: Props) {
  const data = useLiveQuery(async () => ({
    week: await weekOf(Date.now()),
    // Loaded so the week glyph can resolve muscles; never rendered as a list.
    movements: await listMovements(),
  }))

  // The notice rides on the landing screen only. On Liikekirjasto it would be
  // off-topic, and mid-session it would be noise between sets.
  const noticeSeen = useNoticeSeen()
  const [notice, setNotice] = useState(false)

  return (
    <>
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

      {noticeSeen < NOTICE_VERSION && <NoticeStrip onOpen={() => setNotice(true)} />}

      <TodayHero onOpenSession={onOpenSession} onPick={onPick} />

      {data && <WeekStrip week={data.week} onOpenDay={onOpenDay} />}

      {notice && (
        <NoticeSheet
          onClose={() => setNotice(false)}
          onAck={() => {
            void dismissNotice()
            setNotice(false)
          }}
        />
      )}
    </>
  )
}

/** Sliders rather than a gear: three strokes and three knobs stay crisp at 20px,
 *  where a gear's teeth turn to mush. */
function SlidersIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        <circle cx="13" cy="5.5" r="2.1" fill="var(--ground)" />
        <circle cx="7" cy="10" r="2.1" fill="var(--ground)" />
        <circle cx="14.5" cy="14.5" r="2.1" fill="var(--ground)" />
      </g>
    </svg>
  )
}
