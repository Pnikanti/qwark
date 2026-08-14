import { db } from '../db'
import { localDay } from './format'
import { listTemplates } from './session'
import type { LoggedSet, Session, SessionMovement, Template } from '../types'

/**
 * Plausible training history, for looking at screens that need a history to say
 * anything — the movement plot needs three sessions before it will draw, so a
 * fresh install cannot show it at all.
 *
 * Written as `demo-*` session ids so removing it takes back exactly what it
 * added and cannot touch a real session. Deterministic, so the same button
 * produces the same twelve weeks every time rather than a different shape on
 * every tap.
 */
const PREFIX = 'demo-'

/** Sessions per week, and which weekday each lands on (1 = Monday). */
const WEEKDAYS = [1, 3, 5]
/** Nobody trains 12 weeks unbroken. A week off puts a real gap on the axis. */
const WEEK_OFF = 6

/**
 * Where each lift starts, in kg — roughly a year of training. Machines and
 * cables are stack numbers, not plate loads. Anything not listed falls back to
 * its equipment; `pullups` is deliberately 0, which the app reads as bodyweight.
 */
const START_KG: Record<string, number> = {
  'barbell-squat': 70,
  'barbell-deadlift': 90,
  'romanian-deadlift': 60,
  'barbell-bench-press-medium-grip': 55,
  'barbell-incline-bench-press-medium-grip': 45,
  'standing-military-press': 35,
  'bent-over-barbell-row': 50,
  'barbell-lunge': 30,
  'barbell-curl': 25,
  'dumbbell-bicep-curl': 12,
  'side-lateral-raise': 8,
  'leg-press': 100,
  'leg-extensions': 45,
  'seated-leg-curl': 40,
  'standing-calf-raises': 60,
  'seated-cable-rows': 45,
  'wide-grip-lat-pulldown': 45,
  'triceps-pushdown': 25,
  pullups: 0,
}

const EQUIPMENT_KG: Record<string, number> = {
  barbell: 40,
  dumbbell: 12,
  machine: 40,
  cable: 30,
  'body only': 0,
}

const NOTES = [
  'otetta leveämmäksi',
  'kyynärpäät sisään',
  'viimeinen sarja raskas',
  'polvi rutisi, kevennä ensi kerralla',
  'hyvä fiilis',
  'jalat korkeammalle penkillä',
]

/** Deterministic, so the demo is the same history every time it is generated. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const round = (kg: number, step: number) => Math.round(kg / step) * step

interface Progress {
  kg: number
  /** Bodyweight movements progress in reps instead of load. */
  reps: number | null
  stalls: number
}

export interface DemoResult {
  sessions: number
  from: number
  to: number
}

/**
 * Twelve weeks of one programme, three sessions a week.
 *
 * The progression deliberately is not a clean ramp: sets get ground out, loads
 * stall, and a second stall at the same weight backs off ten per cent — the same
 * shape `progressionFor` produces, so the plot shows something a real log would.
 */
export async function seedDemoSessions(weeks = 12): Promise<DemoResult> {
  const templates = await listTemplates()
  const movements = await db.movements.toArray()
  const meta = new Map(movements.map((m) => [m.id, m]))

  // The longest cycle, so the history covers as many movements as possible.
  const byGroup = new Map<string, Template[]>()
  for (const t of templates) {
    if (!t.group) continue
    byGroup.set(t.group, [...(byGroup.get(t.group) ?? []), t])
  }
  const cycle = [...byGroup.values()]
    .sort((a, b) => b.length - a.length)[0]
    ?.sort((a, b) => a.order - b.order)
  if (!cycle?.length) return { sessions: 0, from: 0, to: 0 }

  const random = rng(20260814)
  const progress = new Map<string, Progress>()

  const stateFor = (movementId: string, targetReps: number | null): Progress => {
    const existing = progress.get(movementId)
    if (existing) return existing
    const equipment = meta.get(movementId)?.equipment ?? ''
    const kg = START_KG[movementId] ?? EQUIPMENT_KG[equipment] ?? 20
    const next: Progress = {
      kg,
      reps: kg === 0 ? Math.max(4, (targetReps ?? 8) - 2) : null,
      stalls: 0,
    }
    progress.set(movementId, next)
    return next
  }

  const sessions: Session[] = []
  let index = 0

  // Oldest first, so each movement's progression runs forward in time.
  for (let week = weeks - 1; week >= 0; week--) {
    if (week === WEEK_OFF) continue
    for (const weekday of WEEKDAYS) {
      const template = cycle[index % cycle.length]
      const at = sessionStart(week, weekday, random)
      // A week entirely in the future would be a session you have not done.
      if (at > Date.now()) continue

      const movements: SessionMovement[] = template.items.map((item, i) => {
        const state = stateFor(item.movementId, item.targetReps)
        const step = stepFor(meta.get(item.movementId)?.equipment ?? '')
        const target = item.targetReps ?? 8
        const roll = random()

        // 70% hit every rep, 22% grind the last set out short, 8% is a bad day.
        const shortfall = roll < 0.7 ? 0 : roll < 0.92 ? 2 : 3
        const isBodyweight = state.kg === 0
        const reps = isBodyweight ? state.reps! : target

        const working: LoggedSet[] = Array.from({ length: item.sets }, (_, s) => ({
          kind: 'working' as const,
          kg: state.kg,
          reps: s === item.sets - 1 ? Math.max(1, reps - shortfall) : reps,
          done: true,
          completedAt: at + (i * 8 + s * 2) * 60_000,
        }))

        // An extra set now and then, the way you do when a weight felt light.
        if (shortfall === 0 && random() < 0.08) {
          working.push({ ...working[working.length - 1] })
        }

        if (shortfall === 0) {
          state.stalls = 0
          if (isBodyweight) state.reps = reps + 1
          else state.kg = round(state.kg + step, step)
        } else {
          state.stalls += 1
          if (state.stalls >= 2) {
            state.stalls = 0
            if (isBodyweight) state.reps = Math.max(3, reps - 1)
            else state.kg = round(state.kg * 0.9, step)
          }
        }

        return {
          uid: `${PREFIX}${index}-${i}`,
          movementId: item.movementId,
          targetReps: item.targetReps,
          plannedSets: item.sets,
          restSeconds: item.restSeconds,
          note: random() < 0.06 ? NOTES[Math.floor(random() * NOTES.length)] : null,
          sets: [...warmupsFor(state.kg, at), ...working],
        }
      })

      sessions.push({
        id: `${PREFIX}${index}`,
        templateId: template.id,
        templateName: template.name,
        startedAt: at,
        startedLocalDay: localDay(at),
        finishedAt: at + Math.round((45 + random() * 30) * 60_000),
        movements,
      })
      index += 1
    }
  }

  await db.sessions.bulkPut(sessions)
  return {
    sessions: sessions.length,
    from: sessions[0]?.startedAt ?? 0,
    to: sessions[sessions.length - 1]?.startedAt ?? 0,
  }
}

/** Takes back exactly what seedDemoSessions added, and nothing else. */
export async function removeDemoSessions(): Promise<number> {
  const ids = (await db.sessions.toArray())
    .filter((s) => s.id.startsWith(PREFIX))
    .map((s) => s.id)
  await db.sessions.bulkDelete(ids)
  return ids.length
}

export async function countDemoSessions(): Promise<number> {
  return (await db.sessions.toArray()).filter((s) => s.id.startsWith(PREFIX)).length
}

/** Weekday evenings, with enough jitter that the times are not identical. */
function sessionStart(weeksAgo: number, weekday: number, random: () => number): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  // Back to this week's Monday, then back the requested number of weeks.
  const mondayOffset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - mondayOffset - weeksAgo * 7 + (weekday - 1))
  d.setHours(17, 20 + Math.floor(random() * 40), 0, 0)
  return d.getTime()
}

function stepFor(equipment: string): number {
  return equipment === 'dumbbell' ? 2 : 2.5
}

/**
 * A two-step ramp, only where one makes sense: nobody warms up for lateral
 * raises, and a bodyweight movement has no load to ramp.
 */
function warmupsFor(kg: number, at: number): LoggedSet[] {
  if (kg < 40) return []
  return [
    { kind: 'warmup', kg: Math.max(20, round(kg * 0.45, 2.5)), reps: 8, done: true, completedAt: at },
    { kind: 'warmup', kg: round(kg * 0.75, 2.5), reps: 4, done: true, completedAt: at },
  ]
}
