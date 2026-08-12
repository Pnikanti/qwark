import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NumberPad, type PadMode } from '../components/NumberPad'
import { MovementPicker } from '../components/MovementPicker'
import { useDragReorder } from '../lib/useDragReorder'
import { fi } from '../i18n'
import { listMovements } from '../lib/movements'
import { clock, duration, setsLine } from '../lib/format'
import {
  addMovement,
  addSet,
  finishSession,
  firstIncomplete,
  getSession,
  movementComplete,
  movementProgress,
  nextSetIndex,
  patchSet,
  previousPerformance,
  removeMovement,
  removeSet,
  reorderMovements,
  sessionProgress,
  toggleSetDone,
} from '../lib/session'
import type { LoggedSet, Session, SessionMovement } from '../types'

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
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  /** null follows the workout; a uid means the user parked on that movement.
   *  Tracked by uid, not index, so reordering cannot shift the focus. */
  const [chosenUid, setChosenUid] = useState<string | null>(null)
  const [showLogged, setShowLogged] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const previous = useLiveQuery(async () => {
    if (!session) return {}
    const out: Record<string, string> = {}
    for (const m of session.movements) {
      const prev = await previousPerformance(m.movementId, session.id)
      out[m.movementId] = prev ? setsLine(prev.sets) : ''
    }
    return out
  }, [session?.movements.length, session?.id])

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
  if (restUntil && restUntil <= now) setRestUntil(null)

  const focus = (index: number) => {
    setChosenUid(session.movements[index]?.uid ?? null)
    setShowLogged(false)
  }

  const complete = async (mIndex: number, sIndex: number) => {
    const movement = session.movements[mIndex]
    const wasDone = movement.sets[sIndex].done
    await toggleSetDone(id, mIndex, sIndex)
    if (wasDone) return

    navigator.vibrate?.(12)
    if (movement.restSeconds) setRestUntil(Date.now() + movement.restSeconds * 1000)

    // Advance only when that was the movement's last remaining set.
    const remaining = movement.sets.filter((s, i) => !s.done && i !== sIndex).length
    if (remaining === 0) {
      const next = session.movements.findIndex(
        (m, i) => i !== mIndex && !movementComplete(m),
      )
      setChosenUid(next === -1 ? null : session.movements[next].uid)
      setShowLogged(false)
    }
  }

  const finish = async () => {
    const { kept } = await finishSession(id)
    kept ? onFinished(id) : onDiscarded()
  }

  return (
    <>
      <header className="masthead">
        <div className="masthead-top">
          <div className="grow">
            <h1 className="t-title">{session.templateName ?? fi.today}</h1>
            <span className="t-data">
              {fi.setsOf(progress.done, progress.total)} ·{' '}
              {duration(now - session.startedAt)}
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
          <button className="btn solid" onClick={finish}>
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
                previousLine={previous?.[m.movementId] ?? ''}
                showLogged={showLogged}
                onToggleLogged={() => setShowLogged((v) => !v)}
                handleProps={reorder.handleProps(mIndex)}
                onOpenPad={(sIndex, mode) => setPad({ mIndex, sIndex, mode })}
                onComplete={(sIndex) => complete(mIndex, sIndex)}
                onAddSet={() => addSet(id, mIndex)}
                onRemoveSet={(sIndex) => removeSet(id, mIndex, sIndex)}
                onToggleKind={(sIndex, kind) => patchSet(id, mIndex, sIndex, { kind })}
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
      </ul>

      {/* Appending belongs where the append happens, matching "Lisää sarja" at
          the foot of the expanded movement. Always rendered — an empty ad hoc
          session would otherwise have no way to add anything. */}
      <div className="append">
        <button className="btn btn-tall" onClick={() => setPicking(true)}>
          + {fi.addMovement}
        </button>
      </div>

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
          <span className="t-data rest-next">{nextUpLine(session, active, name)}</span>
        </div>
      )}

      {pad && (
        <NumberPad
          mode={pad.mode}
          label={`${name(session.movements[pad.mIndex].movementId)} · ${fi.set} ${
            pad.sIndex + 1
          }`}
          value={
            pad.mode === 'kg'
              ? session.movements[pad.mIndex].sets[pad.sIndex].kg
              : session.movements[pad.mIndex].sets[pad.sIndex].reps
          }
          onCommit={(v) =>
            patchSet(id, pad.mIndex, pad.sIndex, pad.mode === 'kg' ? { kg: v } : { reps: v })
          }
          onClose={() => setPad(null)}
        />
      )}

      {picking && (
        <MovementPicker
          movements={movements}
          onPick={async (movementId) => {
            await addMovement(id, movementId)
            setPicking(false)
            setChosenUid(null)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}

/** What happens when the timer runs out: the next set here, or the next movement. */
function nextUpLine(
  session: Session,
  active: number,
  name: (id: string) => string,
): string {
  const current = session.movements[active]
  if (current) {
    const index = nextSetIndex(current)
    if (index !== null) {
      const set = current.sets[index]
      const load = set.kg ? ` · ${set.kg} kg × ${set.reps ?? current.targetReps ?? '–'}` : ''
      return `${fi.nextUp}: ${fi.set} ${index + 1}${load}`
    }
  }
  const upcoming = session.movements.find((m, i) => i !== active && !movementComplete(m))
  if (!upcoming) return fi.allSetsDone
  return `${fi.nextUp}: ${name(upcoming.movementId)} · ${fi.setCount(
    movementProgress(upcoming).total,
  )}`
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
  const { done, total } = movementProgress(m)
  const complete = movementComplete(m)
  const logged = m.sets.filter((s) => s.done)

  // Resting means there is time to read, so upcoming rows show their target.
  const detail = complete
    ? setsLine(logged)
    : done > 0
      ? `${done}/${total} · ${setsLine(logged)}`
      : resting && m.targetReps
        ? `${done}/${total} · ${total} × ${m.targetReps}`
        : `${done}/${total}`

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
  showLogged,
  onToggleLogged,
  handleProps,
  onOpenPad,
  onComplete,
  onAddSet,
  onRemoveSet,
  onToggleKind,
  onRemove,
}: {
  movement: SessionMovement
  name: string
  previousLine: string
  showLogged: boolean
  onToggleLogged: () => void
  handleProps: GripProps
  onOpenPad: (sIndex: number, mode: PadMode) => void
  onComplete: (sIndex: number) => void
  onAddSet: () => void
  onRemoveSet: (sIndex: number) => void
  onToggleKind: (sIndex: number, kind: 'warmup' | 'working') => void
  onRemove: () => void
}) {
  const { done, total } = movementProgress(m)
  const next = nextSetIndex(m)
  const logged = m.sets.filter((s) => s.done)

  // Working-set numbers must be counted across all sets: a warmup takes a row
  // but not a number.
  const markers: string[] = []
  let workingIndex = 0
  for (const set of m.sets)
    markers.push(set.kind === 'warmup' ? 'L' : String(++workingIndex))

  const rows = m.sets
    .map((set, sIndex) => ({ set, sIndex }))
    .filter(({ set }) => showLogged || !set.done)

  return (
    <section className="active">
      <div className="active-head">
        <Grip {...handleProps} label={`${fi.reorder}: ${name}`} />
        <h2 className="t-name grow">{name}</h2>
        <span className="t-data">
          {done}/{total}
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

      <p className="prev t-data">
        {previousLine ? `${fi.previous}: ${previousLine}` : fi.noPrevious}
      </p>

      {/* Logged sets are history: one line, reopenable to fix a mistyped load. */}
      {logged.length > 0 && (
        <button className={`doneline${showLogged ? ' open' : ''}`} onClick={onToggleLogged}>
          <span aria-hidden="true">✓</span>
          <span className="grow">{showLogged ? fi.hideLogged : setsLine(logged)}</span>
          <span className="t-data">{showLogged ? '▲' : fi.editLogged}</span>
        </button>
      )}

      {rows.length > 0 && (
        <div className="setgrid">
          <span className="t-data">{fi.set}</span>
          <span className="t-data">kg</span>
          <span className="t-data">{fi.reps}</span>
          <span />
          {rows.map(({ set, sIndex }) => (
            <SetRow
              key={sIndex}
              set={set}
              marker={markers[sIndex]}
              targetReps={m.targetReps}
              isNext={sIndex === next}
              onMarkerClick={() =>
                onToggleKind(sIndex, set.kind === 'warmup' ? 'working' : 'warmup')
              }
              onKg={() => onOpenPad(sIndex, 'kg')}
              onReps={() => onOpenPad(sIndex, 'reps')}
              onDone={() => onComplete(sIndex)}
              onRemove={() => onRemoveSet(sIndex)}
            />
          ))}
        </div>
      )}

      <div className="row-actions">
        <button className="btn" onClick={onAddSet}>
          {fi.addSet}
        </button>
      </div>
    </section>
  )
}

function SetRow({
  set,
  marker,
  targetReps,
  isNext,
  onMarkerClick,
  onKg,
  onReps,
  onDone,
  onRemove,
}: {
  set: LoggedSet
  marker: string
  targetReps: number | null
  isNext: boolean
  onMarkerClick: () => void
  onKg: () => void
  onReps: () => void
  onDone: () => void
  onRemove: () => void
}) {
  const cell = `cell${set.done ? ' locked' : ''}${isNext ? ' next' : ''}`
  return (
    <>
      <button
        className={`marker${set.kind === 'warmup' ? ' warm' : ''}`}
        onClick={onMarkerClick}
        aria-label={set.kind === 'warmup' ? fi.warmup : fi.working}
        title={set.kind === 'warmup' ? fi.warmup : fi.working}
      >
        {marker}
      </button>
      <button className={cell} onClick={onKg}>
        {set.kg ?? '–'}
      </button>
      <button className={cell} onClick={onReps}>
        {set.reps ?? (targetReps !== null ? <em>{targetReps}</em> : '–')}
      </button>
      <span className="set-actions">
        {!set.done && (
          <button className="strip" onClick={onRemove} aria-label={fi.removeSet}>
            ×
          </button>
        )}
        <button
          className={`tick${set.done ? ' on' : ''}`}
          onClick={onDone}
          aria-pressed={set.done}
          aria-label={fi.markDone}
        >
          ✓
        </button>
      </span>
    </>
  )
}
