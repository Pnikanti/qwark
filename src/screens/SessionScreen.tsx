import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NumberPad, type PadMode } from '../components/NumberPad'
import { MovementHistory } from '../components/MovementHistory'
import { MovementPicker } from '../components/MovementPicker'
import { Sheet } from '../components/Sheet'
import { useDragReorder } from '../lib/useDragReorder'
import { fi } from '../i18n'
import { listMovements } from '../lib/movements'
import { clock, duration, kgLabel, setsLine } from '../lib/format'
import {
  progressionFor,
  type Progression,
  type ProgressionKind,
  type ProgressionReason,
} from '../lib/progression'
import { primeAudio, restOver } from '../lib/cue'
import { useAlerts, useGym } from '../lib/settings'
import {
  addMovement,
  applyWarmupRamp,
  commitAsWarmup,
  commitSet,
  draftIndex,
  draftSet,
  finishSession,
  firstIncomplete,
  getSession,
  movementComplete,
  movementProgress,
  nextMovementAfter,
  patchSet,
  previousPerformance,
  previousWarmups,
  removeMovement,
  removeSet,
  reorderMovements,
  setLoggedKind,
  setMovementNote,
  sessionProgress,
  suggestionFor,
} from '../lib/session'
import type { LoggedSet, Session, SessionMovement, SetKind } from '../types'
import type { Suggestion } from '../lib/session'

interface PadTarget {
  mIndex: number
  sIndex: number
  mode: PadMode
}

/** A logged set opened for correction. Held by index within its movement. */
interface EditTarget {
  mIndex: number
  sIndex: number
}

/**
 * One movement is expanded at a time; the rest collapse to a single line.
 * Mid-workout your attention is on one set, and giving five movements equal
 * weight put 92 controls on screen for a one-set decision.
 *
 * The draft is always a working set. Everything that is a *decision* — whether
 * to ramp, correcting a set you mislabelled, removing a movement — is either
 * one tap on an offer or lives behind the movement's `⋯`, because in the gym the
 * screen should ask one question at a time.
 */
export function SessionScreen({
  id,
  onFinished,
  onDiscarded,
}: {
  id: string
  onFinished: (id: string) => void
  onDiscarded: () => void
}) {
  const session = useLiveQuery(() => getSession(id), [id])
  const movements = useLiveQuery(listMovements, [])
  const [pad, setPad] = useState<PadTarget | null>(null)
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [picking, setPicking] = useState(false)
  /** Movement id whose history is open, as a sheet over the session. */
  const [historyOf, setHistoryOf] = useState<string | null>(null)
  /** uid of the movement whose ⋯ menu is open. Keyed by uid, not index, so a
   *  reorder underneath cannot retarget `Poista liike` at another movement. */
  const [menuOf, setMenuOf] = useState<string | null>(null)
  /** uid of the movement whose note is being written. */
  const [notingOf, setNotingOf] = useState<string | null>(null)
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  /** null follows the workout; a uid means the user parked on that movement.
   *  Tracked by uid, not index, so reordering cannot shift the focus. */
  const [chosenUid, setChosenUid] = useState<string | null>(null)
  const [upcomingOpen, setUpcomingOpen] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const gym = useGym()
  const alerts = useAlerts()

  /** What the notification says is next; mirrored so the effect need not re-arm. */
  const cueBody = useRef('')
  /** The rest period already announced, so one period is never heard twice. */
  const cued = useRef<number | null>(null)

  /**
   * Rest ending is an event, so it gets an effect rather than a comparison during
   * render — which is where it used to live, and which re-evaluated on every one
   * of the second-by-second ticks above.
   *
   * Two paths can reach the cue: the timer, and coming back to a page whose timer
   * was frozen. `cued` makes sure only one of them is heard.
   */
  useEffect(() => {
    if (restUntil === null) return

    const ring = () => {
      if (cued.current === restUntil) return
      cued.current = restUntil
      restOver(alerts, fi.restDone, cueBody.current)
      setRestUntil(null)
    }

    const remaining = restUntil - Date.now()
    if (remaining <= 0) {
      ring()
      return
    }
    const t = setTimeout(ring, remaining)
    // A frozen page misses its own timeout, so the cue is reconciled on return
    // instead of being swallowed. Late is a better answer than never.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() >= restUntil) ring()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [restUntil, alerts])

  const context = useLiveQuery(async () => {
    if (!session) return {}
    const out: Record<
      string,
      { line: string; next: Progression; ramp: LoggedSet[] }
    > = {}
    for (const m of session.movements) {
      const prev = await previousPerformance(m.movementId, session.id)
      out[m.movementId] = {
        line: prev ? setsLine(prev.sets) : '',
        next: await progressionFor(m.movementId, m.targetReps, gym, session.id),
        ramp: await previousWarmups(m.movementId),
      }
    }
    return out
  }, [session?.movements.length, session?.id, gym])

  const byId = useMemo(
    () => new Map((movements ?? []).map((m) => [m.id, m])),
    [movements],
  )

  const reorder = useDragReorder(session?.movements.length ?? 0, (from, to) =>
    reorderMovements(id, from, to),
  )

  if (!session || !movements) return <p className="blank note">{fi.loading}</p>

  const name = (movementId: string) =>
    byId.get(movementId)?.nameFi ?? byId.get(movementId)?.nameEn ?? movementId

  const chosenIndex = chosenUid
    ? session.movements.findIndex((m) => m.uid === chosenUid)
    : -1
  const active =
    chosenIndex >= 0
      ? chosenIndex
      : (firstIncomplete(session) ?? session.movements.length - 1)
  const progress = sessionProgress(session)
  const resting = restUntil !== null && restUntil > now

  const upcoming = session.movements.length - 1 - active
  cueBody.current = nextUpLine(session, active, chosenIndex >= 0, name)

  const focus = (index: number) => {
    setChosenUid(session.movements[index]?.uid ?? null)
    setUpcomingOpen(false)
  }

  /** Index of the movement a sheet is open for, or -1. */
  const indexOfUid = (uid: string | null) =>
    uid === null ? -1 : session.movements.findIndex((m) => m.uid === uid)

  /**
   * What the offer resolves to for a movement's draft — the same numbers the
   * cells show greyed and the tick commits, so the three can never disagree.
   * `undefined` context means it has not loaded: no offer yet, or the tick
   * would flip live under a finger already on its way down.
   */
  const offerFor = (m: SessionMovement): Suggestion | null => {
    const draft = draftSet(m)
    const ctx = context?.[m.movementId]
    if (!draft || !ctx) return null
    return suggestionFor(m, draft.kind, ctx.ramp, {
      kg: ctx.next.kg,
      reps: ctx.next.reps,
      fromKg: ctx.next.fromKg,
    })
  }

  /**
   * The number the pad shows greyed when the field is empty — the same offer the
   * cells show. Never shown over a logged set: that is a record being corrected,
   * not a decision waiting to be made.
   */
  const padHint = (at: PadTarget): number | null => {
    const m = session.movements[at.mIndex]
    const set = m.sets[at.sIndex]
    if (!set || set.done) return null
    const s = offerFor(m)
    return at.mode === 'kg' ? (s?.kg ?? null) : (s?.reps ?? null)
  }

  const commit = async (mIndex: number) => {
    const movement = session.movements[mIndex]
    const offer = offerFor(movement)
    const { logged, completedMovement } = await commitSet(
      id,
      mIndex,
      offer ? { kg: offer.kg, reps: offer.reps } : undefined,
    )
    if (!logged) return

    // 12ms was below what a phone's vibration motor can spin up for — accepted by
    // the browser, felt as nothing. Still a tick, not a buzz: this fires 18 times
    // a session and the rest cue has to stay distinguishable from it.
    navigator.vibrate?.(30)

    if (movement.restSeconds) {
      // Inside the tap, because iOS will not start an AudioContext from a timer.
      if (alerts.sound) primeAudio()
      setRestUntil(Date.now() + movement.restSeconds * 1000)
    }

    // Advance once the plan is met. `completedMovement` is decided inside the
    // commit's transaction rather than predicted from this render's snapshot —
    // see `commitSet`. The other movements are untouched by the write, so the
    // snapshot is a fine place to look for where to go next.
    if (completedMovement) {
      const next = nextMovementAfter(session, mIndex)
      setChosenUid(next === null ? null : session.movements[next].uid)
      setUpcomingOpen(false)
    }
  }

  /**
   * The ramp, logged whole. Deliberately not routed through `commit` — that is
   * where the rest timer and the auto-advance live, and neither belongs to
   * warming up.
   */
  const ramp = async (mIndex: number) => {
    const rungs = context?.[session.movements[mIndex].movementId]?.ramp ?? []
    await applyWarmupRamp(id, mIndex, rungs)
    navigator.vibrate?.(30)
  }

  const finish = async () => {
    const { kept } = await finishSession(id)
    kept ? onFinished(id) : onDiscarded()
  }

  const menuIndex = indexOfUid(menuOf)
  const noteIndex = indexOfUid(notingOf)

  return (
    <>
      <header className="masthead">
        <div className="masthead-top">
          <div className="grow">
            <h1 className="t-title">{session.templateName ?? fi.today}</h1>
            <span className="t-data">
              {fi.setsOf(progress.done, progress.total)}
              {progress.extra > 0 && (
                <span className="extra"> {fi.plusExtra(progress.extra)}</span>
              )}{' '}
              · {duration(now - session.startedAt)}
            </span>
          </div>
        </div>
        <div className="rail-track" aria-hidden="true">
          <span
            style={{
              width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="masthead-actions end">
          <button className="btn" onClick={finish}>
            {fi.finish}
          </button>
        </div>
      </header>

      {session.movements.length === 0 && (
        <div className="blank">
          <p className="note">{fi.emptySessionHint}</p>
        </div>
      )}

      <ul className={`stack${reorder.dragging ? ' reordering' : ''}`} ref={reorder.listRef}>
        {session.movements.map((m, mIndex) => (
          <li
            key={m.uid}
            /* Movements still to come are folded behind one line. Mid-set they
               carry almost nothing — six rows of "0/3" — while the ones already
               behind you carry what you lifted. Hidden entirely while dragging
               would break reordering, so the list opens for that. */
            hidden={mIndex > active && !upcomingOpen && !reorder.dragging}
            className={reorder.draggingIndex === mIndex ? 'lifted' : undefined}
            style={
              reorder.dragging
                ? { transform: `translateY(${reorder.rowOffset(mIndex)}px)` }
                : undefined
            }
          >
            {mIndex === active && !reorder.dragging ? (
              <ActiveMovement
                movement={m}
                name={name(m.movementId)}
                previousLine={context?.[m.movementId]?.line ?? ''}
                proposal={context?.[m.movementId]?.next}
                offer={offerFor(m)}
                ready={context !== undefined}
                ramp={context?.[m.movementId]?.ramp ?? []}
                onRamp={() => ramp(mIndex)}
                onOpenHistory={() => setHistoryOf(m.movementId)}
                onOpenMenu={() => setMenuOf(m.uid)}
                onOpenPad={(sIndex, mode) => setPad({ mIndex, sIndex, mode })}
                onEditSet={(sIndex) => setEditing({ mIndex, sIndex })}
                onCommit={() => commit(mIndex)}
                onOpenNote={() => setNotingOf(m.uid)}
              />
            ) : (
              <CollapsedMovement
                movement={m}
                name={name(m.movementId)}
                resting={resting}
                isActive={mIndex === active}
                handleProps={reorder.handleProps(mIndex)}
                onClick={() => focus(mIndex)}
              />
            )}
          </li>
        ))}

        {/* Last row of the list, because that is what appending to a list looks
            like — and above the fold count, which is a footer for the list rather
            than another item in it.

            Shown only once the list is all there: under the fold it invited
            adding a movement while five were still hidden, which is how the same
            lift ends up in a session twice. An empty ad hoc session has nothing
            folded, so it still offers this — that regression is why the condition
            is about the fold and not about the movement count. */}
        {(upcoming === 0 || upcomingOpen) && !reorder.dragging && (
          <li className="append">
            <button className="append-link" onClick={() => setPicking(true)}>
              + {fi.addMovement}
            </button>
          </li>
        )}
      </ul>

      {upcoming > 0 && !reorder.dragging && (
        <button
          className="upcoming"
          aria-expanded={upcomingOpen}
          onClick={() => setUpcomingOpen((v) => !v)}
        >
          <span className="t-data grow">{fi.remainingMovements(upcoming)}</span>
          <span className="t-data">{upcomingOpen ? '▲' : '▾'}</span>
        </button>
      )}

      {resting && (
        <div className="restbar">
          <div className="rest-main">
            <span className="t-data">{fi.rest}</span>
            <span className="rest-clock">{clock((restUntil! - now) / 1000)}</span>
            <button className="btn" onClick={() => setRestUntil(null)}>
              {fi.skipRest}
            </button>
          </div>
          {/* Rest is dead time, so it is where the plan belongs. */}
          <span className="t-data rest-next">
            {nextUpLine(session, active, chosenIndex >= 0, name)}
          </span>
        </div>
      )}

      {menuIndex >= 0 && (
        <MovementMenu
          movement={session.movements[menuIndex]}
          name={name(session.movements[menuIndex].movementId)}
          onClose={() => setMenuOf(null)}
          onWarmup={async () => {
            await commitAsWarmup(id, menuIndex)
            navigator.vibrate?.(30)
            setMenuOf(null)
          }}
          onNote={() => {
            setNotingOf(session.movements[menuIndex].uid)
            setMenuOf(null)
          }}
          onRemove={async () => {
            setMenuOf(null)
            await removeMovement(id, menuIndex)
          }}
        />
      )}

      {noteIndex >= 0 && (
        <NoteSheet
          name={name(session.movements[noteIndex].movementId)}
          value={session.movements[noteIndex].note}
          onSave={(note) => setMovementNote(id, noteIndex, note)}
          onClose={() => setNotingOf(null)}
        />
      )}

      {editing && session.movements[editing.mIndex]?.sets[editing.sIndex]?.done && (
        <SetEditor
          set={session.movements[editing.mIndex].sets[editing.sIndex]}
          label={`${name(session.movements[editing.mIndex].movementId)} · ${
            fi.set
          } ${markerFor(session.movements[editing.mIndex], editing.sIndex)}`}
          onKg={() => {
            setPad({ ...editing, mode: 'kg' })
            setEditing(null)
          }}
          onReps={() => {
            setPad({ ...editing, mode: 'reps' })
            setEditing(null)
          }}
          onKind={(kind) => setLoggedKind(id, editing.mIndex, editing.sIndex, kind)}
          onRemove={async () => {
            const at = editing
            setEditing(null)
            await removeSet(id, at.mIndex, at.sIndex)
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {pad && (
        <NumberPad
          /* Switching kg → reps renders the same element type, so React would
             reconcile and the reps pad would inherit the weight's draft. The key
             forces the remount that `NumberPad`'s fresh-mount state assumes. */
          key={`${pad.mIndex}-${pad.sIndex}-${pad.mode}`}
          mode={pad.mode}
          label={`${name(session.movements[pad.mIndex].movementId)} · ${fi.set} ${
            pad.sIndex + 1
          }`}
          value={
            pad.mode === 'kg'
              ? session.movements[pad.mIndex].sets[pad.sIndex].kg
              : session.movements[pad.mIndex].sets[pad.sIndex].reps
          }
          hint={padHint(pad)}
          onCommit={async (v) => {
            const at = pad
            await patchSet(id, at.mIndex, at.sIndex, at.mode === 'kg' ? { kg: v } : { reps: v })
            // Weight leads to reps on a set being entered; reps is the last
            // field, so it closes and leaves the tick as the only thing left to
            // press. A logged set is a correction of one number, so it closes.
            const draft = !session.movements[at.mIndex].sets[at.sIndex].done
            setPad(draft && at.mode === 'kg' && v !== null ? { ...at, mode: 'reps' } : null)
          }}
          onClose={() => setPad(null)}
        />
      )}

      {historyOf && (
        <MovementHistory
          movementId={historyOf}
          name={name(historyOf)}
          onClose={() => setHistoryOf(null)}
        />
      )}

      {picking && (
        <MovementPicker
          movements={movements}
          onPick={async (movementId) => {
            // You add a movement in order to log it now, so focus follows.
            const uid = await addMovement(id, movementId)
            setPicking(false)
            setChosenUid(uid)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}

/** Label for the set being entered: a planned set, or one beyond the plan. */
function draftLabelFor(m: SessionMovement): string {
  const { done, total, extra } = movementProgress(m)
  if (total !== null && done >= total) return fi.extraSet(extra + 1)
  return fi.setOf(done + 1, total ?? 0)
}

/**
 * What happens when the timer runs out: the next set here, or the next movement.
 *
 * A movement whose plan is met still names its draft when the user has parked on
 * it — they are adding extra sets deliberately, and telling them to move on while
 * the screen asks for another set contradicts the screen.
 */
function nextUpLine(
  session: Session,
  active: number,
  parked: boolean,
  name: (id: string) => string,
): string {
  const current = session.movements[active]
  if (current && (parked || !movementComplete(current))) {
    const draft = draftSet(current)
    if (draft) {
      // `!== null` rather than truthiness: 0 kg is bodyweight, a real load that
      // was deliberately recorded, and it must not read as an empty field.
      const load =
        draft.kg !== null ? ` · ${kgLabel(draft.kg)} kg × ${draft.reps ?? '–'}` : ''
      return `${fi.nextUp}: ${draftLabelFor(current)}${load}`
    }
  }
  const upcoming = session.movements.find((m, i) => i !== active && !movementComplete(m))
  if (!upcoming) return fi.allSetsDone
  const { total } = movementProgress(upcoming)
  return `${fi.nextUp}: ${name(upcoming.movementId)}${
    total === null ? '' : ` · ${fi.setCount(total)}`
  }`
}

function CollapsedMovement({
  movement: m,
  name,
  resting,
  isActive,
  handleProps,
  onClick,
}: {
  movement: SessionMovement
  name: string
  resting: boolean
  isActive: boolean
  handleProps: GripProps
  onClick: () => void
}) {
  const { done, total, extra } = movementProgress(m)
  const complete = movementComplete(m)
  const logged = m.sets.filter((s) => s.done)

  // Resting means there is time to read, so upcoming rows show their target.
  const count = total === null ? `${done}` : `${done}/${total}`
  const withExtra = extra > 0 ? `${count} ${fi.plusExtra(extra)}` : count
  const detail = complete
    ? `${extra > 0 ? `${fi.plusExtra(extra)} · ` : ''}${setsLine(logged)}`
    : done > 0
      ? `${withExtra} · ${setsLine(logged)}`
      : resting && m.targetReps && total !== null
        ? `${count} · ${total} × ${m.targetReps}`
        : count

  return (
    <div className={`folded${complete ? ' is-done' : ''}${isActive ? ' is-active' : ''}`}>
      <Grip {...handleProps} label={`${fi.reorder}: ${name}`} />
      <button className="folded-body" onClick={onClick}>
        <span className="folded-mark" aria-hidden="true">
          {complete ? '✓' : ''}
        </span>
        <span className="folded-name grow">{name}</span>
        <span className="t-data folded-detail">{detail}</span>
      </button>
    </div>
  )
}

/**
 * Where the offered numbers come from, said plainly.
 *
 * `reason` is what makes a held load visible: a deload the user declined must
 * not silently read as "sama kuin viimeksi", or an answer would change a future
 * load with nothing on screen to show for it.
 */
function suggestionText(
  s: Suggestion,
  proposalKind?: ProgressionKind,
  reason?: ProgressionReason,
): string {
  const kg = kgLabel(s.kg)
  if (s.source === 'repeat') return fi.suggestRepeat(kg)
  if (s.source === 'ramp') return fi.suggestRamp(kg, s.reps)
  if (reason === 'bodyweight') return fi.proposalBodyweight
  if (reason === 'toldDay') return fi.proposalHeld(kg)
  if (reason === 'mixed') return fi.proposalMixedLoads(kg)
  if (reason === 'noTarget') return fi.proposalNoTarget(kg)
  if (proposalKind === 'increase' && s.fromKg !== null)
    return fi.proposalIncrease(kg, kgLabel(s.kg - s.fromKg))
  if (proposalKind === 'deload') return fi.proposalDeload(kg)
  return fi.proposalHold(kg)
}

export type GripProps = Omit<React.ComponentProps<'button'>, 'className' | 'children'>

/** Drag handle. Also moves the row with the arrow keys, so it is not mouse-only.
 *  It lives on collapsed rows only — those are what you reorder, and dragging
 *  force-opens the list. The active movement's header has no room for a control
 *  that does nothing to the set in front of you. */
function Grip({ label, ...props }: GripProps & { label: string }) {
  return (
    <button className="grip" aria-label={label} title={label} {...props}>
      <span aria-hidden="true">⠿</span>
    </button>
  )
}

function ActiveMovement({
  movement: m,
  name,
  previousLine,
  proposal,
  offer,
  ready,
  ramp,
  onRamp,
  onOpenHistory,
  onOpenMenu,
  onOpenPad,
  onEditSet,
  onCommit,
  onOpenNote,
}: {
  movement: SessionMovement
  name: string
  previousLine: string
  proposal: Progression | undefined
  offer: Suggestion | null
  /** Whether the offer has loaded. Until it has there is nothing to affirm. */
  ready: boolean
  ramp: LoggedSet[]
  onRamp: () => void
  onOpenHistory: () => void
  onOpenMenu: () => void
  onOpenPad: (sIndex: number, mode: PadMode) => void
  onEditSet: (sIndex: number) => void
  onCommit: () => void
  onOpenNote: () => void
}) {
  const { done, total, extra } = movementProgress(m)
  const draftAt = draftIndex(m)
  const draft = draftAt === null ? null : m.sets[draftAt]
  const anyLogged = m.sets.some((s) => s.done)

  const warmups = m.sets
    .map((set, sIndex) => ({ set, sIndex }))
    .filter(({ set }) => set.done && set.kind === 'warmup')
  const working = m.sets
    .map((set, sIndex) => ({ set, sIndex }))
    .filter(({ set }) => set.done && set.kind === 'working')

  /* Offered only before the first set: a ramp belongs at the start, and the row
     disappearing on the first tap is also what makes a double tap unreachable.
     A ramp with no load is not a ramp — `setsLine` would render it as bare rep
     counts, which says nothing about what to put on the bar. */
  const showRamp =
    !anyLogged && ramp.length > 0 && ramp.some((r) => r.kg !== null && r.kg > 0)

  return (
    <section className="active">
      <div className="active-head">
        <h2 className="t-name grow">{name}</h2>
        <span className="t-data">
          {total === null ? done : `${done}/${total}`}
          {extra > 0 && <span className="extra"> {fi.plusExtra(extra)}</span>}
        </span>
        <button
          className="menu-btn"
          onClick={onOpenMenu}
          aria-haspopup="dialog"
          aria-label={fi.movementActions}
          title={fi.movementActions}
        >
          <span aria-hidden="true">⋯</span>
        </button>
      </div>

      {/* The last session, and the way into every session before it. This line
          used to be inert text labelled "Edellinen" — ambiguous between the
          previous set and the previous session, and a dead end either way. */}
      {/* With no history the label and its value said the same nothing twice, so
          the row folds to the bare door — the same shape the note takes when
          there is nothing written yet. The button itself stays either way: it is
          the only way into the history sheet from here. */}
      <button className="prev" onClick={onOpenHistory}>
        {previousLine && (
          <span className="grow">
            <span className="prev-tag t-data">{fi.previous}</span>
            <span className="t-data">{previousLine}</span>
          </span>
        )}
        <span className="t-data prev-more">{fi.history} ▸</span>
      </button>

      {/* Logged work stays visible as records, one button per set so a
          mislabelled or mistyped one can be corrected where it is read. Warmups
          read on their own line so they are visibly tracked without being
          confused for the work. */}
      {(warmups.length > 0 || working.length > 0) && (
        <div className="logged">
          {warmups.length > 0 && (
            <LoggedLine label={fi.warmupsLabel} rows={warmups} onEdit={onEditSet} />
          )}
          {working.length > 0 && (
            <LoggedLine label={fi.workingLabel} rows={working} onEdit={onEditSet} />
          )}
        </div>
      )}

      {/* The ramp you did last time, as one tap. Warming up is no longer a mode
          you have to notice and switch out of — it is an offer you take or
          ignore, and ignoring it leaves you on the working set. */}
      {showRamp && (
        <button className="ramp" onClick={onRamp}>
          <span className="ramp-tag t-data">{fi.warmupsLabel}</span>
          <span className="t-data grow">{setsLine(ramp)}</span>
          <span className="ramp-apply t-data">{fi.addRamp}</span>
        </button>
      )}

      {/* The one input: the set about to be done. */}
      {draft && draftAt !== null && (
        <Draft
          set={draft}
          offer={ready ? offer : null}
          proposalKind={proposal?.kind}
          proposalReason={proposal?.reason}
          label={draftLabelFor(m)}
          targetReps={m.targetReps}
          onKg={() => onOpenPad(draftAt, 'kg')}
          onReps={() => onOpenPad(draftAt, 'reps')}
          onCommit={onCommit}
        />
      )}

      {/* Shown when there is something to say. Writing one is in the ⋯ menu:
          it matters, but it is not what you came to this screen for. */}
      {m.note && (
        <button className="noteline" onClick={onOpenNote}>
          <span className="grow">{m.note}</span>
          <span className="t-data">{fi.editLogged}</span>
        </button>
      )}
    </section>
  )
}

/** One kind of logged set, as a row of correctable chips. */
function LoggedLine({
  label,
  rows,
  onEdit,
}: {
  label: string
  rows: { set: LoggedSet; sIndex: number }[]
  onEdit: (sIndex: number) => void
}) {
  return (
    <div className="logline">
      <span className="logline-tag t-data">{label}</span>
      {rows.map(({ set, sIndex }) => (
        <button
          key={sIndex}
          className="setchip t-data"
          onClick={() => onEdit(sIndex)}
          aria-label={`${fi.editSet}: ${setsLine([set])}`}
        >
          {setsLine([set])}
        </button>
      ))}
    </div>
  )
}

/** Working sets are numbered; warmups take an L, and do not consume a number. */
function markerFor(m: SessionMovement, sIndex: number): string {
  if (m.sets[sIndex].kind === 'warmup') return 'L'
  let n = 0
  for (let i = 0; i <= sIndex; i++) if (m.sets[i].kind === 'working') n++
  return String(n)
}

/**
 * The input. Always a working set — the kind is not a question asked eighteen
 * times a session, and a set logged in the wrong one is corrected where it is
 * read rather than pre-empted by a mode switch.
 */
function Draft({
  set,
  label,
  offer,
  proposalKind,
  proposalReason,
  targetReps,
  onKg,
  onReps,
  onCommit,
}: {
  set: LoggedSet
  label: string
  offer: Suggestion | null
  proposalKind?: ProgressionKind
  proposalReason?: ProgressionReason
  targetReps: number | null
  onKg: () => void
  onReps: () => void
  onCommit: () => void
}) {
  /* What the tick would commit. `?? null` throughout and never truthiness: 0 is
     a value — it means bodyweight — and only null means never entered. This is
     the same resolution `commitSet` performs inside its transaction, so an
     enabled tick can never turn out to be a no-op. */
  const kg = set.kg ?? offer?.kg ?? null
  const reps = set.reps ?? offer?.reps ?? targetReps ?? null
  const ready = kg !== null && reps !== null

  const missing =
    kg === null && reps === null
      ? fi.needBoth
      : kg === null
        ? fi.needWeight
        : reps === null
          ? fi.needReps
          : null

  return (
    <div className="draft">
      <span className="t-data draft-label">{label}</span>

      <div className="draft-row">
        <Cell
          value={set.kg}
          offered={offer?.kg ?? null}
          unit="kg"
          format={kgLabel}
          onClick={onKg}
        />
        <Cell
          value={set.reps}
          offered={offer?.reps ?? targetReps ?? null}
          unit={fi.reps}
          format={String}
          onClick={onReps}
        />
        <button
          className="tick big"
          onClick={onCommit}
          disabled={!ready}
          aria-label={fi.logSet}
        >
          ✓
        </button>
      </div>

      {/* Where the offered load came from. Only while it is still an offer: once
          a weight is typed, a line reading "Ehdotus 92,5 kg" under a cell showing
          100 would be describing a number that is no longer on screen. */}
      {offer && set.kg === null && (
        <p className={`offer-why t-data kind-${proposalKind ?? 'hold'}`}>
          {suggestionText(offer, proposalKind, proposalReason)}
        </p>
      )}

      {missing && <p className="draft-missing t-data">{missing}</p>}
    </div>
  )
}

/**
 * One field of the input.
 *
 * A stored value renders solid; an offer renders greyed and dashed, borrowing the
 * pad's language exactly — grey means shown but not entered, dashed means
 * inferred. A rep target copied from the routine you picked is *stored*, so it
 * reads solid: it is a plan, not a guess.
 */
function Cell({
  value,
  offered,
  unit,
  format,
  onClick,
}: {
  value: number | null
  offered: number | null
  unit: string
  format: (n: number) => string
  onClick: () => void
}) {
  const shown = value ?? offered
  const isOffer = value === null && offered !== null
  return (
    <button className="cell next" onClick={onClick}>
      <span
        className={`cell-value${isOffer ? ' is-ghost is-offer' : ''}`}
        aria-label={isOffer ? `${fi.padOffer} ${format(offered!)}` : undefined}
      >
        {shown === null ? '–' : format(shown)}
      </span>
      <span className="cell-unit t-data">{unit}</span>
    </button>
  )
}

/**
 * Everything about the movement that is not the set in front of you.
 *
 * Built on `Sheet` rather than hand-rolled, so it gets the focus trap, Escape and
 * focus restore the five older sheets in this app do without.
 */
function MovementMenu({
  movement: m,
  name,
  onClose,
  onWarmup,
  onNote,
  onRemove,
}: {
  movement: SessionMovement
  name: string
  onClose: () => void
  onWarmup: () => void
  onNote: () => void
  onRemove: () => void
}) {
  const draft = draftSet(m)
  // Logging the draft as a warmup uses the numbers already in the input rather
  // than asking for them twice, so it needs them to be there.
  const canWarmup = draft !== null && draft.kg !== null && draft.reps !== null

  return (
    <Sheet label={name} onClose={onClose}>
      <div className="sheet-head">
        <span className="t-data">{name}</span>
        <button className="revert" onClick={onClose}>
          {fi.close}
        </button>
      </div>
      <div className="menu">
        <button className="menu-item" onClick={onWarmup} disabled={!canWarmup}>
          <span className="grow">{fi.logAsWarmup}</span>
        </button>
        {!canWarmup && <p className="note menu-hint">{fi.logAsWarmupHint}</p>}
        <button className="menu-item" onClick={onNote}>
          <span className="grow">{m.note ? fi.editNote : fi.addNote}</span>
        </button>
        <button className="menu-item danger" onClick={onRemove}>
          <span className="grow">{fi.removeMovement}</span>
        </button>
      </div>
    </Sheet>
  )
}

/** Correcting a set already logged. Where a mislabelled warmup gets fixed. */
function SetEditor({
  set,
  label,
  onKg,
  onReps,
  onKind,
  onRemove,
  onClose,
}: {
  set: LoggedSet
  label: string
  onKg: () => void
  onReps: () => void
  onKind: (kind: SetKind) => void
  onRemove: () => void
  onClose: () => void
}) {
  return (
    <Sheet label={label} onClose={onClose}>
      <div className="sheet-head">
        <span className="t-data">{label}</span>
        <button className="revert" onClick={onClose}>
          {fi.close}
        </button>
      </div>

      <div className="draft-row edit-row">
        <button className="cell next" onClick={onKg}>
          <span className="cell-value">{set.kg === null ? '–' : kgLabel(set.kg)}</span>
          <span className="cell-unit t-data">kg</span>
        </button>
        <button className="cell next" onClick={onReps}>
          <span className="cell-value">{set.reps ?? '–'}</span>
          <span className="cell-unit t-data">{fi.reps}</span>
        </button>
      </div>

      {/* The kind lives here rather than on the input, because this is the only
          moment it is ever wrong: you know what a set was once you have done it.
          A warmup counts towards nothing, so being able to say so afterwards is
          what keeps the numbers honest. */}
      <div className="segmented" role="group" aria-label={fi.setKind}>
        {(['warmup', 'working'] as SetKind[]).map((kind) => (
          <button
            key={kind}
            className="segment"
            aria-pressed={set.kind === kind}
            onClick={() => onKind(kind)}
          >
            {kind === 'warmup' ? fi.warmupsLabel : fi.working}
          </button>
        ))}
      </div>

      <button className="menu-item danger" onClick={onRemove}>
        <span className="grow">{fi.removeSet}</span>
      </button>
    </Sheet>
  )
}

/**
 * Notes matter but they are not what you came to this screen for, so writing one
 * is a deliberate trip through the menu. Carried forward from the last session,
 * so a standing cue keeps showing up.
 */
function NoteSheet({
  name,
  value,
  onSave,
  onClose,
}: {
  name: string
  value: string | null
  onSave: (note: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value ?? '')

  return (
    <Sheet label={fi.note} onClose={onClose}>
      <div className="sheet-head">
        <span className="t-data">
          {fi.note} · {name}
        </span>
        <button className="revert" onClick={onClose}>
          {fi.close}
        </button>
      </div>
      <textarea
        className="note-input"
        autoFocus
        rows={3}
        value={draft}
        placeholder={fi.notePlaceholder}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        className="btn solid btn-tall sheet-commit"
        onClick={() => {
          onSave(draft)
          onClose()
        }}
      >
        {fi.done}
      </button>
    </Sheet>
  )
}
