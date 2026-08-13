import { db } from '../db'
import { listMovements } from './movements'
import { completedSetCount, volumeKg, workingDone } from './session'
import type { Session } from '../types'

export interface WeekDay {
  /** Midnight at the start of this day. */
  at: number
  weekday: string
  isToday: boolean
  isFuture: boolean
  sessions: Session[]
}

export interface Week {
  /** ISO week number, as Finland counts them. */
  number: number
  start: number
  end: number
  days: WeekDay[]
  sessionCount: number
  setCount: number
  volume: number
  /**
   * Working sets per muscle group this week, 0..1 against the busiest group.
   * Sets rather than kilos: volume in kg scores every bodyweight movement as
   * zero, and sets per muscle per week is the measure lifters actually use.
   */
  muscleLoad: Record<string, number>
  /** Muscle groups with any work at all, for the glyph's primary tone. */
  workedMuscles: string[]
  /** Raw weighted set counts, for a readable "8 sarjaa" label. */
  setsPerMuscle: Record<string, number>
}

const WEEKDAYS = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su']

/** Monday-based, as Finland counts weeks. */
export function startOfWeek(at: number): number {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** ISO 8601 week number: week 1 is the one containing the first Thursday. */
export function isoWeek(at: number): number {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const firstThursday = new Date(d.getFullYear(), 0, 4)
  firstThursday.setDate(
    firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7),
  )
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / 604800000)
}

export async function weekOf(at: number): Promise<Week> {
  const start = startOfWeek(at)
  const end = start + 7 * 86400000

  const [all, movements] = await Promise.all([db.sessions.toArray(), listMovements()])
  const sessions = all.filter(
    (s) => s.finishedAt !== null && s.startedAt >= start && s.startedAt < end,
  )

  const midnight = (t: number) => {
    const d = new Date(t)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const today = midnight(Date.now())

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const dayStart = midnight(start + i * 86400000)
    return {
      at: dayStart,
      weekday: WEEKDAYS[i],
      isToday: dayStart === today,
      isFuture: dayStart > today,
      sessions: sessions.filter((s) => midnight(s.startedAt) === dayStart),
    }
  })

  // Working sets per muscle: primary counts fully, secondary at half — it does
  // work but it is not what the movement is for.
  const byId = new Map(movements.map((m) => [m.id, m]))
  const raw: Record<string, number> = {}
  for (const s of sessions) {
    for (const m of s.movements) {
      const sets = workingDone(m)
      if (!sets) continue
      const movement = byId.get(m.movementId)
      if (!movement) continue
      for (const muscle of movement.primaryMuscles) {
        raw[muscle] = (raw[muscle] ?? 0) + sets
      }
      for (const muscle of movement.secondaryMuscles) {
        raw[muscle] = (raw[muscle] ?? 0) + sets * 0.5
      }
    }
  }
  const peak = Math.max(1, ...Object.values(raw))
  const muscleLoad: Record<string, number> = {}
  for (const [muscle, n] of Object.entries(raw)) muscleLoad[muscle] = n / peak

  return {
    number: isoWeek(start),
    start,
    end,
    days,
    sessionCount: sessions.length,
    setCount: sessions.reduce((n, s) => n + completedSetCount(s), 0),
    volume: sessions.reduce((n, s) => n + volumeKg(s), 0),
    muscleLoad,
    workedMuscles: Object.keys(raw),
    setsPerMuscle: raw,
  }
}
