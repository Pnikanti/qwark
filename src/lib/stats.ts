import { db } from '../db'
import type { LoggedSet } from '../types'

/** What the library needs to say about a movement you have trained. */
export interface MovementStat {
  /** Finished sessions that logged at least one working set of it. */
  sessions: number
  lastAt: number
  /** Heaviest working set, or the longest one when nothing carried a load. */
  best: LoggedSet | null
}

/**
 * Training totals for every movement at once.
 *
 * One pass over sessions rather than a query per row: the library renders 68 rows
 * and `movementHistory` walks the whole session table each time it is called, so
 * per-row calls would be 68 full scans to draw one screen.
 *
 * Warmups are excluded, as everywhere else — they are logged work but not the
 * work, and a movement you have only ever warmed up on has not been trained.
 */
export async function movementStats(): Promise<Map<string, MovementStat>> {
  const out = new Map<string, MovementStat>()
  const sessions = await db.sessions.toArray()

  for (const session of sessions) {
    if (session.finishedAt === null) continue
    // A session can hold the same movement twice; it still counts once.
    const seen = new Set<string>()

    for (const movement of session.movements) {
      const working = movement.sets.filter((s) => s.done && s.kind === 'working')
      if (!working.length) continue

      const current = out.get(movement.movementId)
      const first = !seen.has(movement.movementId)
      seen.add(movement.movementId)

      out.set(movement.movementId, {
        sessions: (current?.sessions ?? 0) + (first ? 1 : 0),
        lastAt: Math.max(current?.lastAt ?? 0, session.startedAt),
        best: working.reduce(betterOf, current?.best ?? null),
      })
    }
  }
  return out
}

/**
 * Heavier wins; reps break the tie. A movement with no load anywhere falls back
 * to reps, or bodyweight work would report no best set at all.
 */
function betterOf(best: LoggedSet | null, set: LoggedSet): LoggedSet {
  if (!best) return set
  const a = best.kg ?? 0
  const b = set.kg ?? 0
  if (a !== b) return b > a ? set : best
  return (set.reps ?? 0) > (best.reps ?? 0) ? set : best
}
