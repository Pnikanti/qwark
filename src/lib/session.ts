import { db } from '../db'
import type {
  LoggedSet,
  Session,
  SessionMovement,
  SetKind,
  Template,
} from '../types'

const id = () =>
  globalThis.crypto?.randomUUID?.() ?? `s${Date.now()}${Math.random().toString(36).slice(2)}`

const emptySet = (kind: SetKind = 'working'): LoggedSet => ({
  kind,
  kg: null,
  reps: null,
  done: false,
  completedAt: null,
})

/* --- reading ------------------------------------------------------------- */

/** The session still open, if any. Drives the resume banner on Tänään. */
export function activeSession(): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.finishedAt === null).first()
}

export function getSession(sessionId: string): Promise<Session | undefined> {
  return db.sessions.get(sessionId)
}

export async function finishedSessions(limit = 30): Promise<Session[]> {
  const all = await db.sessions.orderBy('startedAt').reverse().toArray()
  return all.filter((s) => s.finishedAt !== null).slice(0, limit)
}

export function listTemplates(): Promise<Template[]> {
  return db.templates.toArray()
}

/**
 * The last completed sets for a movement, for the "Edellinen" line and for
 * pre-filling. Working sets only — warmups are not the thing you compare to.
 */
export async function previousPerformance(
  movementId: string,
  excludeSessionId?: string,
): Promise<{ at: number; sets: LoggedSet[] } | null> {
  const sessions = await db.sessions.orderBy('startedAt').reverse().toArray()
  for (const s of sessions) {
    if (s.id === excludeSessionId || s.finishedAt === null) continue
    const m = s.movements.find((x) => x.movementId === movementId)
    if (!m) continue
    const sets = m.sets.filter((x) => x.done && x.kind === 'working')
    if (sets.length) return { at: s.startedAt, sets }
  }
  return null
}

/* --- starting ------------------------------------------------------------ */

/**
 * Copies the plan out of the template. Later edits to the template cannot
 * rewrite this session — that separation is required, not incidental.
 */
export async function startSession(template?: Template): Promise<string> {
  const session: Session = {
    id: id(),
    templateId: template?.id ?? null,
    templateName: template?.name ?? null,
    startedAt: Date.now(),
    finishedAt: null,
    movements: (template?.items ?? []).map((item) => ({
      uid: id(),
      movementId: item.movementId,
      targetReps: item.targetReps,
      restSeconds: item.restSeconds,
      note: null,
      sets: Array.from({ length: item.sets }, () => emptySet()),
    })),
  }

  // Pre-fill loads and reps from the last time each movement was trained.
  for (const m of session.movements) {
    const prev = await previousPerformance(m.movementId)
    if (!prev) continue
    m.sets = m.sets.map((s, i) => {
      const from = prev.sets[Math.min(i, prev.sets.length - 1)]
      return { ...s, kg: from?.kg ?? null, reps: from?.reps ?? m.targetReps }
    })
  }

  await db.sessions.put(session)
  return session.id
}

/* --- mutating ------------------------------------------------------------ */

/** Every write goes through here, so each change hits IndexedDB immediately. */
async function mutate(
  sessionId: string,
  fn: (session: Session) => void,
): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) throw new Error(`unknown session: ${sessionId}`)
    fn(session)
    await db.sessions.put(session)
  })
}

export const addMovement = (sessionId: string, movementId: string) =>
  mutate(sessionId, (s) => {
    s.movements.push({
      uid: id(),
      movementId,
      targetReps: null,
      restSeconds: null,
      note: null,
      sets: [emptySet()],
    })
  })

/**
 * Move a movement. `session.movements` order is the stored order, so persisting
 * the new arrangement needs nothing beyond writing the array back.
 */
export const reorderMovements = (sessionId: string, from: number, to: number) =>
  mutate(sessionId, (s) => {
    if (from === to) return
    const clamped = Math.max(0, Math.min(s.movements.length - 1, to))
    const [moved] = s.movements.splice(from, 1)
    s.movements.splice(clamped, 0, moved)
  })

export const removeMovement = (sessionId: string, index: number) =>
  mutate(sessionId, (s) => {
    s.movements.splice(index, 1)
  })

export const addSet = (sessionId: string, mIndex: number) =>
  mutate(sessionId, (s) => {
    const m = s.movements[mIndex]
    const last = m.sets.at(-1)
    m.sets.push({ ...emptySet(), kg: last?.kg ?? null, reps: last?.reps ?? m.targetReps })
  })

export const removeSet = (sessionId: string, mIndex: number, sIndex: number) =>
  mutate(sessionId, (s) => {
    s.movements[mIndex].sets.splice(sIndex, 1)
  })

export const patchSet = (
  sessionId: string,
  mIndex: number,
  sIndex: number,
  changes: Partial<LoggedSet>,
) =>
  mutate(sessionId, (s) => {
    Object.assign(s.movements[mIndex].sets[sIndex], changes)
  })

/** Completing a set is the app's most-repeated action: one tap, three effects. */
export const toggleSetDone = (sessionId: string, mIndex: number, sIndex: number) =>
  mutate(sessionId, (s) => {
    const set = s.movements[mIndex].sets[sIndex]
    set.done = !set.done
    set.completedAt = set.done ? Date.now() : null
    if (set.done && set.reps === null) set.reps = s.movements[mIndex].targetReps
  })

export const setMovementNote = (sessionId: string, mIndex: number, note: string) =>
  mutate(sessionId, (s) => {
    s.movements[mIndex].note = note.trim() || null
  })

/**
 * Finish. A session with no completed sets is discarded rather than saved as
 * junk, and empty trailing sets are dropped so the summary reflects reality.
 */
export async function finishSession(
  sessionId: string,
): Promise<{ kept: boolean }> {
  const session = await db.sessions.get(sessionId)
  if (!session) return { kept: false }

  const completed = session.movements.some((m) => m.sets.some((s) => s.done))
  if (!completed) {
    await db.sessions.delete(sessionId)
    return { kept: false }
  }

  session.movements = session.movements
    .map((m) => ({ ...m, sets: m.sets.filter((s) => s.done) }))
    .filter((m) => m.sets.length > 0)
  session.finishedAt = Date.now()
  await db.sessions.put(session)
  return { kept: true }
}

export const discardSession = (sessionId: string) => db.sessions.delete(sessionId)

/** Save a finished ad hoc session as a reusable routine. */
export async function saveAsTemplate(sessionId: string, name: string): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) return
  await db.templates.put({
    id: id(),
    group: null,
    name: name.trim() || 'Uusi ohjelma',
    seeded: false,
    createdAt: Date.now(),
    items: session.movements.map((m) => ({
      movementId: m.movementId,
      sets: m.sets.filter((s) => s.kind === 'working').length || m.sets.length,
      targetReps: m.targetReps,
      restSeconds: m.restSeconds,
    })),
  })
}

/* --- maths --------------------------------------------------------------- */

/** Working sets only: warmups are not training volume. */
export function volumeKg(session: Session): number {
  let total = 0
  for (const m of session.movements)
    for (const s of m.sets)
      if (s.done && s.kind === 'working' && s.kg && s.reps) total += s.kg * s.reps
  return Math.round(total)
}

export function completedSetCount(session: Session): number {
  return session.movements.reduce(
    (n, m) => n + m.sets.filter((s) => s.done).length,
    0,
  )
}

/** Epley. Only meaningful for low-rep working sets, so cap the range. */
export function estimatedOneRepMax(kg: number, reps: number): number | null {
  if (!kg || !reps || reps > 12) return null
  return Math.round(kg * (1 + reps / 30))
}

export function bestWorkingSet(m: SessionMovement): LoggedSet | null {
  return (
    m.sets
      .filter((s) => s.done && s.kind === 'working' && s.kg !== null)
      .sort((a, b) => (b.kg ?? 0) * (b.reps ?? 1) - (a.kg ?? 0) * (a.reps ?? 1))[0] ??
    null
  )
}

/** Heaviest completed working set for a movement before this session. */
export async function previousBestKg(
  movementId: string,
  excludeSessionId: string,
): Promise<number> {
  const sessions = await db.sessions.toArray()
  let best = 0
  for (const s of sessions) {
    if (s.id === excludeSessionId || s.finishedAt === null) continue
    for (const m of s.movements) {
      if (m.movementId !== movementId) continue
      for (const set of m.sets)
        if (set.done && set.kind === 'working' && set.kg) best = Math.max(best, set.kg)
    }
  }
  return best
}

/* --- progress ------------------------------------------------------------ */

export function movementProgress(m: SessionMovement): { done: number; total: number } {
  return { done: m.sets.filter((s) => s.done).length, total: m.sets.length }
}

export function movementComplete(m: SessionMovement): boolean {
  const { done, total } = movementProgress(m)
  return total > 0 && done === total
}

export function sessionProgress(session: Session): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const m of session.movements) {
    total += m.sets.length
    done += m.sets.filter((s) => s.done).length
  }
  return { done, total }
}

/** Index of the movement to focus: the first with sets still to log. */
export function firstIncomplete(session: Session): number | null {
  const i = session.movements.findIndex((m) => !movementComplete(m))
  return i === -1 ? null : i
}

/** Index of the next set to log within a movement, or null if none remain. */
export function nextSetIndex(m: SessionMovement): number | null {
  const i = m.sets.findIndex((s) => !s.done)
  return i === -1 ? null : i
}
