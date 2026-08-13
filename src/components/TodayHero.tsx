import { useLiveQuery } from 'dexie-react-hooks'
import { BodyPlan } from './BodyPlan'
import { db } from '../db'
import { fi } from '../i18n'
import { duration, localDay, shortDate, weekdayName } from '../lib/format'
import { listMovements } from '../lib/movements'
import { currentRotation } from '../lib/rotation'
import {
  activeSession,
  completedSetCount,
  startSession,
  volumeKg,
} from '../lib/session'
import { useProfile } from '../lib/settings'

/**
 * The centrepiece: who you are, when it is, and what today could be.
 *
 * These were three separate things — a greeting line, a mid-page card, and a
 * bottom bar — which left the most important question ("what do I train?") as the
 * smallest text on the screen while a retrospective week strip carried the visual
 * weight. This inverts that. Centre-aligned, deliberately, as the one exception to
 * the left-aligned ledger language everywhere else.
 */
export function TodayHero({
  onOpenSession,
  onPick,
}: {
  onOpenSession: (id: string) => void
  onPick: () => void
}) {
  const profile = useProfile()

  const data = useLiveQuery(async () => {
    const today = localDay(Date.now())
    return {
      active: await activeSession(),
      current: await currentRotation(),
      doneToday: (await db.sessions.toArray())
        .filter((s) => s.finishedAt !== null && s.startedLocalDay === today)
        .sort((a, b) => b.startedAt - a.startedAt),
      movements: await listMovements(),
    }
  })

  const greeting = (
    <>
      <p className="hero-greeting">{fi.greeting(Date.now(), profile.name)}</p>
      <p className="hero-date t-data">
        {weekdayName(Date.now())} {new Date().getDate()}.{new Date().getMonth() + 1}.
      </p>
    </>
  )

  if (!data) return <section className="hero">{greeting}</section>

  const byId = new Map(data.movements.map((m) => [m.id, m]))

  /* An open session outranks everything. Stale ones never reach here — see
     activeSession — so this only fires for a workout genuinely underway. */
  if (data.active) {
    const session = data.active
    return (
      <section className="hero">
        {greeting}
        <span className="hero-tag t-data">{fi.inProgress}</span>
        <h2 className="hero-name">{session.templateName ?? fi.startEmpty}</h2>
        <p className="hero-meta t-data">
          {fi.setCount(completedSetCount(session))} ·{' '}
          {duration(Date.now() - session.startedAt)}
        </p>
        <button className="btn solid hero-action" onClick={() => onOpenSession(session.id)}>
          {fi.resume}
        </button>
      </section>
    )
  }

  /* Trained already today: acknowledge it. Proposing the next routine the moment
     you finish one reads as nagging, so what is next is stated, not offered. */
  if (data.doneToday.length > 0) {
    const sets = data.doneToday.reduce((n, s) => n + completedSetCount(s), 0)
    const volume = data.doneToday.reduce((n, s) => n + volumeKg(s), 0)
    return (
      <section className="hero">
        {greeting}
        <span className="hero-tag t-data done">{fi.trainedToday}</span>
        <h2 className="hero-name">
          {data.doneToday.map((s) => s.templateName ?? fi.startEmpty).join(' · ')}
        </h2>
        <p className="hero-meta t-data">
          {fi.setCount(sets)}
          {volume > 0 && ` · ${volume.toLocaleString('fi')} kg`}
        </p>
        {data.current && (
          <p className="hero-meta t-data">
            {fi.nextTime}: {data.current.next.name}
          </p>
        )}
        <button className="btn hero-action" onClick={onPick}>
          {fi.anotherWorkout}
        </button>
      </section>
    )
  }

  /* No cycle position yet, so nothing is proposed — that would be inventing a
     plan from no history. */
  if (!data.current) {
    return (
      <section className="hero">
        {greeting}
        <p className="hero-meta t-data">{fi.pickToBegin}</p>
        <button className="btn solid hero-action" onClick={onPick}>
          {fi.chooseRoutine}
        </button>
      </section>
    )
  }

  const next = data.current.next
  const primary = next.items.flatMap((i) => byId.get(i.movementId)?.primaryMuscles ?? [])
  const secondary = next.items.flatMap(
    (i) => byId.get(i.movementId)?.secondaryMuscles ?? [],
  )
  const totalSets = next.items.reduce((n, i) => n + i.sets, 0)
  const movementNames = next.items
    .map((i) => byId.get(i.movementId)?.nameFi ?? byId.get(i.movementId)?.nameEn ?? '')
    .filter(Boolean)
    .join(' · ')

  // The group is dropped when the routine name already carries it: "5×5 · 2/2"
  // beside "5×5 B" says the same thing twice.
  const group = data.current.group
  const meta = [
    next.name.startsWith(group) ? null : group,
    `${data.current.position}/${data.current.length}`,
    `${next.items.length} ${fi.movementWord(next.items.length)}`,
    fi.setCount(totalSets),
  ].filter(Boolean) as string[]

  const lastDoneAt =
    data.current.entries.find((e) => e.template.id === next.id)?.lastDoneAt ?? null

  return (
    <section className="hero">
      {greeting}

      {/* The tag comes first so the figure belongs to it: SEURAAVA → what it
          works → what it is called. */}
      <span className="hero-tag t-data">{fi.nextUp}</span>

      <BodyPlan
        className="hero-figure"
        primary={primary}
        secondary={secondary}
        view="both"
        size={104}
        title={fi.worksThese}
      />

      <h2 className="hero-name">{next.name}</h2>
      <p className="hero-meta t-data">{meta.join(' · ')}</p>
      {lastDoneAt !== null && (
        <p className="hero-meta t-data">{fi.lastDone(shortDate(lastDoneAt))}</p>
      )}
      <p className="hero-movements t-data">{movementNames}</p>

      <button
        className="btn solid hero-action"
        onClick={async () => onOpenSession(await startSession(next))}
      >
        {fi.start}
      </button>
      <button className="hero-secondary" onClick={onPick}>
        {fi.otherOptions} ▸
      </button>
    </section>
  )
}
