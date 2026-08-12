import { db } from '../db'
import { snapLoad, stepKg } from './plates'
import type { GymSettings, LoggedSet } from '../types'

export type ProgressionKind = 'first' | 'increase' | 'hold' | 'deload'

export interface Progression {
  kind: ProgressionKind
  /** Load to pre-fill. null when there is nothing to go on. */
  kg: number | null
  reps: number | null
  /** What was lifted last time, for the "+2,5" hint. */
  fromKg: number | null
}

interface Performance {
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
    out.push({ at: session.startedAt, targetReps: movement.targetReps, sets })
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
 * The result is a proposal — it pre-fills an editable field, nothing more.
 */
export async function progressionFor(
  movementId: string,
  targetReps: number | null,
  gym: GymSettings,
  excludeSessionId?: string,
): Promise<Progression> {
  const history = await recent(movementId, 2, excludeSessionId)
  if (!history.length) {
    return { kind: 'first', kg: null, reps: targetReps, fromKg: null }
  }

  const last = history[0]
  // A movement logged ad hoc has no declared target, so the honest default is
  // the reps actually performed last time.
  const reps = targetReps ?? last.targetReps ?? (last.sets.at(-1)?.reps ?? null)
  const uniform = uniformLoad(last)
  const load = uniform ?? maxLoad(last)

  // Never entered a load: nothing to go on.
  if (load === null) return { kind: 'hold', kg: null, reps, fromKg: null }

  // An explicit 0 means bodyweight. Progress there is more reps, not more kilos —
  // adding a plate pair would be proposing a weight belt on the user's behalf.
  if (load === 0) return { kind: 'hold', kg: 0, reps, fromKg: 0 }

  const met = uniform === null ? null : metTarget(last)

  if (met === true) {
    return {
      kind: 'increase',
      kg: snapLoad(load + stepKg(gym), gym),
      reps,
      fromKg: load,
    }
  }

  if (met === false) {
    const before = history[1]
    const repeated =
      before !== undefined &&
      uniformLoad(before) === load &&
      metTarget(before) === false
    if (repeated) {
      return { kind: 'deload', kg: snapLoad(load * 0.9, gym), reps, fromKg: load }
    }
  }

  return { kind: 'hold', kg: load, reps, fromKg: load }
}
