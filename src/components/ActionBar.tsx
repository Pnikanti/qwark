import { useLiveQuery } from 'dexie-react-hooks'
import { fi } from '../i18n'
import { relativeAge, weekdayName } from '../lib/format'
import { currentRotation } from '../lib/rotation'
import { activeSession, completedSetCount, startSession } from '../lib/session'

/**
 * The one action, at the thumb.
 *
 * This carries what used to be the Seuraava card and the resume banner, which
 * were both mid-page. Moving them here leaves the week as the entire landing
 * screen and puts the primary action where a thumb actually reaches.
 *
 * Runs its own query rather than taking props: it lives in the app's bottom dock
 * next to the tab bar, not inside the screen it acts for.
 */
export function ActionBar({
  onResume,
  onStarted,
  onPick,
}: {
  onResume: (id: string) => void
  onStarted: (sessionId: string) => void
  /** Opens the routine picker for today. */
  onPick: () => void
}) {
  const data = useLiveQuery(async () => ({
    active: await activeSession(),
    current: await currentRotation(),
  }))

  if (!data) return null

  // An unfinished session outranks everything: nothing else should be started.
  if (data.active) {
    return (
      <div className="actionbar resuming">
        <span className="t-data actionbar-label">
          {data.active.templateName ?? fi.startEmpty} ·{' '}
          {/* "aloitettu 3 vrk sitten" would be nonsense for a session you are
              logging after the fact; name the day instead. */}
          {data.active.retro
            ? fi.loggingFor(weekdayName(data.active.startedAt))
            : fi.startedAgo(relativeAge(data.active.startedAt))}{' '}
          · {fi.setCount(completedSetCount(data.active))}
        </span>
        <div className="actionbar-row">
          <button className="btn solid grow" onClick={() => onResume(data.active!.id)}>
            {fi.resume}
          </button>
        </div>
      </div>
    )
  }

  // Before any templated session there is no cycle position, so there is nothing
  // to propose — the bar becomes a way to choose rather than a way to confirm.
  if (!data.current) {
    return (
      <div className="actionbar">
        <div className="actionbar-row">
          <button className="btn solid grow" onClick={onPick}>
            {fi.chooseRoutine}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="actionbar">
      <span className="t-data actionbar-label">
        {fi.nextUp} · {data.current.next.name} · {data.current.position}/
        {data.current.length}
      </span>
      <div className="actionbar-row">
        <button
          className="btn solid grow"
          onClick={async () => onStarted(await startSession(data.current!.next))}
        >
          {fi.start}
        </button>
        <button className="btn" onClick={onPick}>
          {fi.otherRoutines} ▸
        </button>
      </div>
    </div>
  )
}
