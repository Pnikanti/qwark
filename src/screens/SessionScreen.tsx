import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NumberPad, type PadMode } from '../components/NumberPad'
import { MovementHistory } from '../components/MovementHistory'
import { MovementPicker } from '../components/MovementPicker'
import { useDragReorder } from '../lib/useDragReorder'
import { fi } from '../i18n'
import { listMovements } from '../lib/movements'
import { toast } from '../lib/toast'
import { clock, duration, kgLabel, setsLine } from '../lib/format'
import {
  progressionFor,
  type Progression,
  type ProgressionKind,
} from '../lib/progression'
import { primeAudio, restOver } from '../lib/cue'
import { useAlerts, useGym } from '../lib/settings'
import {
  addMovement,
  commitSet,
  convertWarmupsToWorking,
  draftIndex,
  draftSet,
  finishSession,
  firstIncomplete,
  getSession,
  movementComplete,
  movementProgress,
  patchSet,
  previousPerformance,
  previousWarmups,
  removeMovement,
  removeSet,
  reorderMovements,
  setDraftKind,
  setMovementNote,
  sessionProgress,
  suggestionFor,
  warmupOnlyMovements,
  warmupsDone,
  workingDone,
} from '../lib/session'
import type { LoggedSet, Session, SessionMovement, SetKind } from '../types'
import type { Suggestion } from '../lib/session'

interface PadTarget {
  mIndex: number
  sIndex: number
  mode: PadMode
}

/**
 * One movement is expanded at a time; the rest collapse to a single line.
 * Mid-workout your attention is on one set, and giving five movements equal
 * weight put 92 controls on screen for a one-set decision.
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
  const [picking, setPicking] = useState(false)
  /** Movement id whose history is open, as a sheet over the session. */
  const [historyOf, setHistoryOf] = useState<string | null>(null)
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  /** null follows the workout; a uid means the user parked on that movement.
   *  Tracked by uid, not index, so reordering cannot shift the focus. */
  const [chosenUid, setChosenUid] = useState<string | null>(null)
  const [showLogged, setShowLogged] = useState(false)
  const [upcomingOpen, setUpcomingOpen] = useState(false)
  /** Movement indices holding only warmups, held while the check is on screen. */
  const [warmupOnly, setWarmupOnly] = useState<number[] | null>(null)

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
    setShowLogged(false)
    setUpcomingOpen(false)
  }

  /**
   * The number the pad shows greyed when the field is empty — the same
   * inference the `Täytä` row below the input offers, so the two can never
   * disagree about what is being proposed. Never shown over a logged set: that
   * is a record being corrected, not a decision waiting to be made.
   */
  const padHint = (at: PadTarget): number | null => {
    const m = session.movements[at.mIndex]
    const set = m.sets[at.sIndex]
    const ctx = context?.[m.movementId]
    if (!set || set.done || !ctx?.next) return null
    const s = suggestionFor(m, set.kind, ctx.ramp, {
      kg: ctx.next.kg,
      reps: ctx.next.reps,
      fromKg: ctx.next.fromKg,
    })
    return at.mode === 'kg' ? (s?.kg ?? null) : (s?.reps ?? null)
  }

  const commit = async (mIndex: number) => {
    const movement = session.movements[mIndex]
    const draft = movement.sets.at(-1)
    if (!draft || draft.done) return
    const wasWarmup = draft.kind === 'warmup'

    await commitSet(id, mIndex)
    // 12ms was below what a phone's vibration motor can spin up for — accepted by
    // the browser, felt as nothing. Still a tick, not a buzz: this fires 18 times
    // a session and the rest cue has to stay distinguishable from it.
    navigator.vibrate?.(30)

    // Warmups are moved through quickly; a countdown after each would be noise.
    if (!wasWarmup && movement.restSeconds) {
      // Inside the tap, because iOS will not start an AudioContext from a timer.
      if (alerts.sound) primeAudio()
      setRestUntil(Date.now() + movement.restSeconds * 1000)
    }

    // Advance once the plan is met. Warmups never trigger this.
    if (wasWarmup) return
    // Only on the transition into completion — otherwise every extra set would
    // bounce you off a movement you deliberately came back to.
    const planned = movement.plannedSets
    if (planned !== null && workingDone(movement) + 1 === planned) {
      const next = session.movements.findIndex(
        (m, i) => i !== mIndex && !movementComplete(m),
      )
      setChosenUid(next === -1 ? null : session.movements[next].uid)
      setShowLogged(false)
    }
  }

  const close = async () => {
    const { kept } = await finishSession(id)
    kept ? onFinished(id) : onDiscarded()
  }

  /**
   * Everything opens on Lämmittely, and a warmup counts towards nothing, so a
   * movement logged entirely in the wrong mode would vanish from every number
   * the app keeps. Checked here rather than mid-set: switching modes on purpose
   * is normal, and only at the end is it clear you never switched back.
   */
  const finish = async () => {
    // A session with nothing logged has nothing to relabel — it is discarded, as
    // it always was. This has to come first or the guard fires on an empty one.
    const logged = session.movements.some((m) => m.sets.some((s) => s.done))
    const suspect = logged ? warmupOnlyMovements(session) : []
    if (suspect.length > 0) {
      setWarmupOnly(suspect)
      return
    }
    await close()
  }

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
                ramp={context?.[m.movementId]?.ramp ?? []}
                onApply={(kg, reps) =>
                  patchSet(id, mIndex, m.sets.length - 1, { kg, reps })
                }
                showLogged={showLogged}
                onToggleLogged={() => setShowLogged((v) => !v)}
                onOpenHistory={() => setHistoryOf(m.movementId)}
                handleProps={reorder.handleProps(mIndex)}
                onOpenPad={(sIndex, mode) => setPad({ mIndex, sIndex, mode })}
                onCommit={() => commit(mIndex)}
                onRemoveSet={(sIndex) => removeSet(id, mIndex, sIndex)}
                onSetKind={(kind) => setDraftKind(id, mIndex, kind)}
                onNote={(note) => setMovementNote(id, mIndex, note)}
                onRemove={() => removeMovement(id, mIndex)}
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
            // Weight leads to reps; reps is the last field, so it closes and
            // leaves the tick as the only thing left to press.
            setPad(at.mode === 'kg' && v !== null ? { ...at, mode: 'reps' } : null)
          }}
          onClose={() => setPad(null)}
        />
      )}

      {warmupOnly && (
        <div className="sheet-backdrop" onClick={() => setWarmupOnly(null)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={fi.checkBeforeFinish}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-head">
              <span className="t-data">{fi.checkBeforeFinish}</span>
              <button className="revert" onClick={() => setWarmupOnly(null)}>
                {fi.close}
              </button>
            </div>

            <p className="check-intro">{fi.warmupOnlyIntro(warmupOnly.length)}</p>
            <ul className="ledger check-list">
              {warmupOnly.map((mIndex) => {
                const m = session.movements[mIndex]
                return (
                  <li key={m.uid} className="check-row">
                    <span className="t-name">{name(m.movementId)}</span>
                    <span className="logline">
                      <span className="logline-tag t-data">{fi.warmupsLabel}</span>
                      {setsLine(warmupsDone(m))}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="note">{fi.warmupOnlyWhy}</p>

            {/* Neither is the default. Warming up and stopping is a real thing
                that happens, so the app must not quietly rewrite it — and a
                mis-logged session must not quietly disappear either. */}
            <div className="check-actions">
              <button
                className="btn btn-tall"
                onClick={async () => {
                  await convertWarmupsToWorking(id, warmupOnly)
                  toast(fi.markedAsWorking(warmupOnly.length))
                  setWarmupOnly(null)
                  await close()
                }}
              >
                {fi.markAsWorking}
              </button>
              <button
                className="btn btn-tall"
                onClick={async () => {
                  setWarmupOnly(null)
                  await close()
                }}
              >
                {fi.finishAnyway}
              </button>
            </div>
          </div>
        </div>
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
            setShowLogged(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}

/** Label for the set being entered: warmup, planned set, or one beyond the plan. */
function draftLabelFor(m: SessionMovement, draft: LoggedSet): string {
  if (draft.kind === 'warmup') return fi.warmupNumber(warmupsDone(m).length + 1)
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
      const load = draft.kg ? ` · ${kgLabel(draft.kg)} kg × ${draft.reps ?? '–'}` : ''
      return `${fi.nextUp}: ${draftLabelFor(current, draft)}${load}`
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

/** Where the offered numbers come from, said plainly. */
function suggestionText(s: Suggestion, proposalKind?: ProgressionKind): string {
  const kg = kgLabel(s.kg)
  if (s.source === 'repeat') return fi.suggestRepeat(kg)
  if (s.source === 'ramp') return fi.suggestRamp(kg, s.reps)
  if (proposalKind === 'increase' && s.fromKg !== null)
    return fi.proposalIncrease(kg, kgLabel(s.kg - s.fromKg))
  if (proposalKind === 'deload') return fi.proposalDeload(kg)
  return fi.proposalHold(kg)
}

export type GripProps = Omit<React.ComponentProps<'button'>, 'className' | 'children'>

/** Drag handle. Also moves the row with the arrow keys, so it is not mouse-only. */
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
  ramp,
  onApply,
  showLogged,
  onToggleLogged,
  onOpenHistory,
  handleProps,
  onOpenPad,
  onCommit,
  onRemoveSet,
  onSetKind,
  onNote,
  onRemove,
}: {
  movement: SessionMovement
  name: string
  previousLine: string
  proposal: Progression | undefined
  ramp: LoggedSet[]
  onApply: (kg: number, reps: number | null) => void
  showLogged: boolean
  onToggleLogged: () => void
  onOpenHistory: () => void
  handleProps: GripProps
  onNote: (note: string) => void
  onOpenPad: (sIndex: number, mode: PadMode) => void
  onCommit: () => void
  onRemoveSet: (sIndex: number) => void
  onSetKind: (kind: SetKind) => void
  onRemove: () => void
}) {
  const { done, total, extra } = movementProgress(m)
  const draftAt = draftIndex(m)
  const draft = draftAt === null ? null : m.sets[draftAt]
  const warmups = warmupsDone(m)
  const working = m.sets.filter((s) => s.done && s.kind === 'working')
  const loggedRows = m.sets
    .map((set, sIndex) => ({ set, sIndex }))
    .filter(({ set }) => set.done)

  return (
    <section className="active">
      <div className="active-head">
        <Grip {...handleProps} label={`${fi.reorder}: ${name}`} />
        <h2 className="t-name grow">{name}</h2>
        <span className="t-data">
          {total === null ? done : `${done}/${total}`}
          {extra > 0 && <span className="extra"> {fi.plusExtra(extra)}</span>}
        </span>
        <button
          className="quiet-x"
          onClick={onRemove}
          aria-label={fi.removeMovement}
          title={fi.removeMovement}
        >
          ×
        </button>
      </div>

      {/* The last session, and the way into every session before it. This line
          used to be inert text labelled "Edellinen" — ambiguous between the
          previous set and the previous session, and a dead end either way. */}
      {/* With no history the label and its value said the same nothing twice, so
          the row folds to the bare door — the same shape `Note` takes when there
          is nothing written yet. The button itself stays either way: it is the
          only way into the history sheet from here. */}
      <button className="prev" onClick={onOpenHistory}>
        {previousLine && (
          <span className="grow">
            <span className="prev-tag t-data">{fi.previous}</span>
            <span className="t-data">{previousLine}</span>
          </span>
        )}
        <span className="t-data prev-more">{fi.history} ▸</span>
      </button>


      {/* Logged work is history. Warmups read on their own line so they are
          visibly tracked without being confused for the work. */}
      {(warmups.length > 0 || working.length > 0) && !showLogged && (
        <button className="doneline" onClick={onToggleLogged}>
          <span className="grow">
            {warmups.length > 0 && (
              <span className="logline">
                <span className="logline-tag t-data">{fi.warmupsLabel}</span>
                {setsLine(warmups)}
              </span>
            )}
            {working.length > 0 && (
              <span className="logline">
                <span className="logline-tag t-data">{fi.workingLabel}</span>
                {setsLine(working)}
              </span>
            )}
          </span>
          <span className="t-data">{fi.editLogged}</span>
        </button>
      )}

      {showLogged && (
        <>
          <button className="doneline open" onClick={onToggleLogged}>
            <span className="grow t-data">{fi.hideLogged}</span>
            <span className="t-data">▲</span>
          </button>
          <div className="setgrid">
            <span className="t-data">{fi.set}</span>
            <span className="t-data">kg</span>
            <span className="t-data">{fi.reps}</span>
            <span />
            {loggedRows.map(({ set, sIndex }) => (
              <LoggedRow
                key={sIndex}
                set={set}
                marker={markerFor(m, sIndex)}
                onKg={() => onOpenPad(sIndex, 'kg')}
                onReps={() => onOpenPad(sIndex, 'reps')}
                onRemove={() => onRemoveSet(sIndex)}
              />
            ))}
          </div>
        </>
      )}

      {/* The one input: the set about to be done. */}
      {draft && draftAt !== null && (
        <Draft
          set={draft}
          suggestion={
            proposal
              ? suggestionFor(m, draft.kind, ramp, {
                  kg: proposal.kg,
                  reps: proposal.reps,
                  fromKg: proposal.fromKg,
                })
              : null
          }
          proposalKind={proposal?.kind}
          onApply={onApply}
          label={draftLabelFor(m, draft)}
          onSetKind={onSetKind}
          onKg={() => onOpenPad(draftAt, 'kg')}
          onReps={() => onOpenPad(draftAt, 'reps')}
          onCommit={onCommit}
        />
      )}

      <Note value={m.note} onChange={onNote} />
    </section>
  )
}

/**
 * Folded away unless there is something to say — notes matter but they are not
 * what you came to this screen for. Carried forward from the last session, so a
 * standing cue keeps showing up.
 */
function Note({
  value,
  onChange,
}: {
  value: string | null
  onChange: (note: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  if (!open && !value)
    return (
      <button className="revert note-add" onClick={() => setOpen(true)}>
        + {fi.note}
      </button>
    )

  if (!open)
    return (
      <button className="noteline" onClick={() => setOpen(true)}>
        <span className="grow">{value}</span>
        <span className="t-data">{fi.editLogged}</span>
      </button>
    )

  return (
    <div className="field note-field">
      <div className="field-label">
        <span className="t-data">{fi.note}</span>
      </div>
      <textarea
        className="note-input"
        autoFocus
        rows={2}
        value={draft}
        placeholder={fi.notePlaceholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onChange(draft)
          setOpen(false)
        }}
      />
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
 * The input. One set at a time, with the kind chosen before logging so a warmup
 * is a first-class entry rather than a working row that got reclassified.
 */
function Draft({
  set,
  label,
  suggestion,
  proposalKind,
  onApply,
  onSetKind,
  onKg,
  onReps,
  onCommit,
}: {
  set: LoggedSet
  label: string
  suggestion: Suggestion | null
  proposalKind?: ProgressionKind
  onApply: (kg: number, reps: number | null) => void
  onSetKind: (kind: SetKind) => void
  onKg: () => void
  onReps: () => void
  onCommit: () => void
}) {
  // 0 is a value; null is not. A set with either field unset has nothing in it.
  const missing =
    set.kg === null && set.reps === null
      ? fi.needBoth
      : set.kg === null
        ? fi.needWeight
        : set.reps === null
          ? fi.needReps
          : null

  const warmup = set.kind === 'warmup'

  return (
    /* The mode colours the whole input, not just the switch. A warmup really is a
       different kind of record — excluded from volume, from 1RM and from
       progression — so it should not look like a working set with a chip toggled. */
    <div className={`draft${warmup ? ' is-warmup' : ''}`}>
      <div className="segmented" role="group" aria-label={fi.setKind}>
        {(['warmup', 'working'] as SetKind[]).map((kind) => (
          <button
            key={kind}
            className="segment"
            aria-pressed={set.kind === kind}
            onClick={() => onSetKind(kind)}
          >
            {kind === 'warmup' ? fi.warmupsLabel : fi.working}
          </button>
        ))}
      </div>

      <span className="t-data draft-label">{label}</span>

      <div className="draft-row">
        <button className="cell next" onClick={onKg}>
          <span className="cell-value">{set.kg === null ? '–' : kgLabel(set.kg)}</span>
          <span className="cell-unit t-data">kg</span>
        </button>
        <button className="cell next" onClick={onReps}>
          <span className="cell-value">{set.reps ?? '–'}</span>
          <span className="cell-unit t-data">{fi.reps}</span>
        </button>
        <button
          className="tick big"
          onClick={onCommit}
          disabled={missing !== null}
          aria-label={fi.logSet}
        >
          ✓
        </button>
      </div>

      {/* Inferred, never applied on its own — one tap fills the blanks. */}
      {suggestion && set.kg === null && (
        <button
          className={`suggestion t-data kind-${proposalKind ?? 'hold'}`}
          onClick={() => onApply(suggestion.kg, set.reps ?? suggestion.reps)}
        >
          <span className="grow">{suggestionText(suggestion, proposalKind)}</span>
          <span className="suggestion-apply">{fi.applySuggestion}</span>
        </button>
      )}

      {missing && !suggestion && <p className="draft-missing t-data">{missing}</p>}
    </div>
  )
}

/** A set already logged: editable, deletable, never un-tickable. */
function LoggedRow({
  set,
  marker,
  onKg,
  onReps,
  onRemove,
}: {
  set: LoggedSet
  marker: string
  onKg: () => void
  onReps: () => void
  onRemove: () => void
}) {
  return (
    <>
      <span className={`marker static${set.kind === 'warmup' ? ' warm' : ''}`}>
        {marker}
      </span>
      <button className="cell locked" onClick={onKg}>
        {set.kg === null ? '–' : kgLabel(set.kg)}
      </button>
      <button className="cell locked" onClick={onReps}>
        {set.reps ?? '–'}
      </button>
      <span className="set-actions">
        <button className="quiet-x" onClick={onRemove} aria-label={fi.removeSet}>
          ×
        </button>
      </span>
    </>
  )
}
