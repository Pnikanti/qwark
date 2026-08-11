import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NumberPad, type PadMode } from '../components/NumberPad'
import { MovementPicker } from '../components/MovementPicker'
import { fi } from '../i18n'
import { listMovements } from '../lib/movements'
import { clock, duration, setsLine } from '../lib/format'
import {
  addMovement,
  addSet,
  finishSession,
  getSession,
  patchSet,
  previousPerformance,
  removeMovement,
  removeSet,
  toggleSetDone,
} from '../lib/session'
import type { LoggedSet, SessionMovement } from '../types'

interface PadTarget {
  mIndex: number
  sIndex: number
  mode: PadMode
}

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

  // One ticking clock drives both the elapsed time and the rest countdown.
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

  if (!session || !movements) return <p className="blank note">{fi.loading}</p>

  const restLeft = restUntil ? (restUntil - now) / 1000 : 0
  if (restUntil && restLeft <= 0) setRestUntil(null)

  const complete = async (mIndex: number, sIndex: number) => {
    const wasDone = session.movements[mIndex].sets[sIndex].done
    await toggleSetDone(id, mIndex, sIndex)
    if (wasDone) return
    navigator.vibrate?.(12)
    const rest = session.movements[mIndex].restSeconds
    if (rest) setRestUntil(Date.now() + rest * 1000)
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
              {duration(now - session.startedAt)} ·{' '}
              {fi.setCount(
                session.movements.reduce(
                  (n, m) => n + m.sets.filter((s) => s.done).length,
                  0,
                ),
              )}
            </span>
          </div>
        </div>
        <div className="masthead-actions">
          <button className="btn" onClick={() => setPicking(true)}>
            {fi.addMovement}
          </button>
          <button className="btn solid" onClick={finish}>
            {fi.finish}
          </button>
        </div>
      </header>

      {session.movements.length === 0 && (
        <div className="blank">
          <span className="t-data">{fi.addMovement}</span>
          <p className="note">{fi.firstRunHint}</p>
        </div>
      )}

      {session.movements.map((m, mIndex) => (
        <MovementBlock
          key={`${m.movementId}-${mIndex}`}
          movement={m}
          name={byId.get(m.movementId)?.nameFi ?? byId.get(m.movementId)?.nameEn ?? m.movementId}
          previousLine={previous?.[m.movementId] ?? ''}
          onOpenPad={(sIndex, mode) => setPad({ mIndex, sIndex, mode })}
          onComplete={(sIndex) => complete(mIndex, sIndex)}
          onAddSet={() => addSet(id, mIndex)}
          onRemoveSet={(sIndex) => removeSet(id, mIndex, sIndex)}
          onToggleKind={(sIndex, kind) => patchSet(id, mIndex, sIndex, { kind })}
          onRemove={() => removeMovement(id, mIndex)}
        />
      ))}

      {restUntil && (
        <div className="restbar">
          <span className="t-data">{fi.rest}</span>
          <span className="rest-clock">{clock(restLeft)}</span>
          <button className="btn" onClick={() => setRestUntil(null)}>
            {fi.skipRest}
          </button>
        </div>
      )}

      {pad && (
        <NumberPad
          mode={pad.mode}
          label={`${byId.get(session.movements[pad.mIndex].movementId)?.nameFi ?? ''} · ${
            fi.set
          } ${pad.sIndex + 1}`}
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
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}

function MovementBlock({
  movement: m,
  name,
  previousLine,
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
  onOpenPad: (sIndex: number, mode: PadMode) => void
  onComplete: (sIndex: number) => void
  onAddSet: () => void
  onRemoveSet: (sIndex: number) => void
  onToggleKind: (sIndex: number, kind: 'warmup' | 'working') => void
  onRemove: () => void
}) {
  let workingIndex = 0
  return (
    <section className="panel movement">
      <div className="movement-head">
        <h2 className="t-name grow">{name}</h2>
        <button className="quiet-x" onClick={onRemove} aria-label={fi.removeMovement} title={fi.removeMovement}>
          ×
        </button>
      </div>
      <p className="prev t-data">
        {previousLine ? `${fi.previous}: ${previousLine}` : fi.noPrevious}
      </p>

      <div className="setgrid">
        <span className="t-data">{fi.set}</span>
        <span className="t-data">kg</span>
        <span className="t-data">{fi.reps}</span>
        <span />
        {m.sets.map((set, sIndex) => {
          const marker = set.kind === 'warmup' ? 'L' : String(++workingIndex)
          return (
            <SetRow
              key={sIndex}
              set={set}
              marker={marker}
              targetReps={m.targetReps}
              onMarkerClick={() =>
                onToggleKind(sIndex, set.kind === 'warmup' ? 'working' : 'warmup')
              }
              onKg={() => onOpenPad(sIndex, 'kg')}
              onReps={() => onOpenPad(sIndex, 'reps')}
              onDone={() => onComplete(sIndex)}
              onRemove={() => onRemoveSet(sIndex)}
            />
          )
        })}
      </div>

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
  onMarkerClick,
  onKg,
  onReps,
  onDone,
  onRemove,
}: {
  set: LoggedSet
  marker: string
  targetReps: number | null
  onMarkerClick: () => void
  onKg: () => void
  onReps: () => void
  onDone: () => void
  onRemove: () => void
}) {
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
      <button className={`cell${set.done ? ' locked' : ''}`} onClick={onKg}>
        {set.kg ?? '–'}
      </button>
      <button className={`cell${set.done ? ' locked' : ''}`} onClick={onReps}>
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
          aria-label={fi.working}
        >
          ✓
        </button>
      </span>
    </>
  )
}
