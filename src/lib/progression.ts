import { db } from '../db'
import { snapLoad, stepKg } from './plates'
import type { GymSettings, LoggedSet, MovementAnswer } from '../types'

export type ProgressionKind = 'first' | 'increase' | 'hold' | 'deload'

/**
 * Why the proposal is what it is.
 *
 * Added because three branches below could only say `hold` and could not say
 * why — bodyweight work, mixed loads and a missing target all looked identical
 * on screen, and a bodyweight movement even proposed "0 kg". The reason is
 * display-only; no arithmetic depends on it.
 */
export type ProgressionReason =
  /** The plain rules decided it. */
  | 'rule'
  /** Deload confirmed: the user said the load was too heavy. */
  | 'toldLoad'
  /** Held: the user said the miss was the day, not the load. */
  | 'toldDay'
  /** Load 0 — progress is reps, not kilos. */
  | 'bodyweight'
  /** Sets used different loads; the number is the heaviest of them. */
  | 'mixed'
  /** No target reps to judge against. */
  | 'noTarget'
  /** A load was never entered. */
  | 'noLoad'

export interface Progression {
  kind: ProgressionKind
  /** The load to offer. null when there is nothing to go on. */
  kg: number | null
  reps: number | null
  /** What was lifted last time, for the "+2,5" hint. */
  fromKg: number | null
  reason: ProgressionReason
}

interface Performance {
  /** The session this came from, so an answer about it can be looked up. */
  id: string
  at: number
  targetReps: number | null
  sets: LoggedSet[]
}

/** The last `limit` completed sessions containing this movement, newest first. */
async function recent(
  movementId: string,
  limit: number,
  excludeSessionId?: string,
): Promise<Performance[]> {
  const sessions = await db.sessions.orderBy('startedAt').reverse().toArray()
  const out: Performance[] = []
  for (const session of sessions) {
    if (session.finishedAt === null || session.id === excludeSessionId) continue
    const movement = session.movements.find((m) => m.movementId === movementId)
    if (!movement) continue
    const sets = movement.sets.filter((s) => s.done && s.kind === 'working')
    if (!sets.length) continue
    out.push({
      id: session.id,
      at: session.startedAt,
      targetReps: movement.targetReps,
      sets,
    })
    if (out.length === limit) break
  }
  return out
}

/** The load, if every working set used the same one. */
function uniformLoad(p: Performance): number | null {
  const kg = p.sets[0].kg
  if (kg === null) return null
  return p.sets.every((s) => s.kg === kg) ? kg : null
}

function maxLoad(p: Performance): number | null {
  const loads = p.sets.map((s) => s.kg).filter((kg): kg is number => kg !== null)
  return loads.length ? Math.max(...loads) : null
}

/** null when there is no target to judge against. */
function metTarget(p: Performance): boolean | null {
  const target = p.targetReps
  if (target === null) return null
  return p.sets.every((s) => (s.reps ?? 0) >= target)
}

/**
 * What to load next time, from what happened last time.
 *
 *   every working set hit its target reps  → add one step
 *   a set fell short                       → hold
 *   fell short twice running at that load  → back off ~10%
 *
 * Bodyweight work and mixed-load sessions can only be held: there is no single
 * load to advance, and guessing one would be worse than proposing nothing.
 *
 * The result is a proposal. It is offered below the input and applied only when
 * tapped — it is never written into the field, which is the rule commit 05e6614
 * established and which the pad's greyed ghost preserves.
 *
 * The one thing that can change the verdict is the user's own answer about why
 * a lift fell short, and only in one direction: see `afterAnswer`.
 */
export async function progressionFor(
  movementId: string,
  targetReps: number | null,
  gym: GymSettings,
  excludeSessionId?: string,
): Promise<Progression> {
  const history = await recent(movementId, 2, excludeSessionId)
  if (!history.length) {
    return { kind: 'first', kg: null, reps: targetReps, fromKg: null, reason: 'rule' }
  }

  const last = history[0]
  // A movement logged ad hoc has no declared target, so the honest default is
  // the reps actually performed last time.
  const reps = targetReps ?? last.targetReps ?? (last.sets.at(-1)?.reps ?? null)
  const uniform = uniformLoad(last)
  const load = uniform ?? maxLoad(last)

  // Never entered a load: nothing to go on.
  if (load === null) {
    return { kind: 'hold', kg: null, reps, fromKg: null, reason: 'noLoad' }
  }

  // An explicit 0 means bodyweight. Progress there is more reps, not more kilos —
  // adding a plate pair would be proposing a weight belt on the user's behalf.
  if (load === 0) {
    return { kind: 'hold', kg: 0, reps, fromKg: 0, reason: 'bodyweight' }
  }

  const hit = metTarget(last)
  const met = uniform === null ? null : hit

  if (met === true) {
    return {
      kind: 'increase',
      kg: snapLoad(load + stepKg(gym), gym),
      reps,
      fromKg: load,
      reason: 'rule',
    }
  }

  if (met === false) {
    const before = history[1]
    const repeated =
      before !== undefined &&
      uniformLoad(before) === load &&
      metTarget(before) === false
    if (repeated) {
      // Only the newest of the two shortfalls is consulted, so an answer steers
      // exactly one proposal and then expires on its own: once a newer session
      // exists, `recent` no longer reaches this row and there is no expiry
      // bookkeeping to write.
      const said = (await db.sessionFeedback.get(last.id))?.answers[movementId]
      return afterAnswer(
        {
          kind: 'deload',
          kg: snapLoad(load * 0.9, gym),
          reps,
          fromKg: load,
          reason: 'rule',
        },
        said ?? null,
        load,
      )
    }
  }

  return {
    kind: 'hold',
    kg: load,
    reps,
    fromKg: load,
    reason: uniform === null ? 'mixed' : hit === null ? 'noTarget' : 'rule',
  }
}

/**
 * What an answer does to the rules' verdict.
 *
 * One rule governs it, and it is the whole safety argument:
 *
 *   an answer may hold a load the rules would have moved,
 *   it may never move a load the rules would have held.
 *
 * Holding at the old load proposes a weight with two sessions of direct
 * evidence behind it. Turning a hold into an increase would propose one with
 * none — which is the assertion `session.ts` forbids.
 *
 * Pure and gym-free: every branch proposes a load that was already lifted, so
 * there is nothing to snap. Exported because the dialogue must state the same
 * number the next session will offer, and one function is the only way the two
 * cannot disagree.
 */
export function afterAnswer(
  base: Progression,
  answer: MovementAnswer | null,
  load: number,
): Progression {
  if (base.kind !== 'deload' || answer === null) return base
  switch (answer.value) {
    // The miss was the day, not the weight — so the weight stands.
    case 'day':
      return { ...base, kind: 'hold', kg: load, reason: 'toldDay' }
    // Confirmed: the cut is what the user asked for.
    case 'load':
      return { ...base, reason: 'toldLoad' }
    // No claim either way leaves the rule alone.
    case 'unsure':
      return base
  }
}
