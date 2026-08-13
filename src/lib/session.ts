import { db } from '../db'
import { localDay, noonOn } from './format'
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

/**
 * How long an open session stays resumable. Past this, you did not pause — you
 * finished training and forgot to say so.
 */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000

/** When training last actually happened: the newest completed set, else the start. */
export function lastActivityAt(session: Session): number {
  let latest = session.startedAt
  for (const m of session.movements)
    for (const set of m.sets)
      if (set.completedAt && set.completedAt > latest) latest = set.completedAt
  return latest
}

export function isStale(session: Session, now: number = Date.now()): boolean {
  return now - lastActivityAt(session) > STALE_AFTER_MS
}

/**
 * The open session worth resuming. A stale one is deliberately excluded: offering
 * to continue a workout from this morning is worse than offering nothing.
 */
export async function activeSession(): Promise<Session | undefined> {
  const open = await db.sessions.filter((s) => s.finishedAt === null).first()
  return open && !isStale(open) ? open : undefined
}

/**
 * Close out sessions nobody is coming back to. Called at startup.
 *
 * The logged sets are real training, so they are kept and the session is finished
 * at its last completed set — which is when training actually stopped, and gives
 * an honest duration. One with nothing logged is discarded, the same rule
 * finishSession applies.
 */
export async function closeStaleSessions(): Promise<number> {
  const open = await db.sessions.filter((s) => s.finishedAt === null).toArray()
  let closed = 0
  for (const session of open) {
    if (!isStale(session)) continue
    const done = session.movements
      .map((m) => ({ ...m, sets: m.sets.filter((x) => x.done) }))
      .filter((m) => m.sets.length > 0)
    if (!done.length) {
      await db.sessions.delete(session.id)
      continue
    }
    await db.sessions.put({
      ...session,
      movements: done,
      finishedAt: session.retro ? session.startedAt : lastActivityAt(session),
    })
    closed++
  }
  return closed
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

/**
 * Last session's warmup ramp for this movement. The counterpart to
 * previousPerformance, which deliberately looks at working sets only.
 */
export async function previousWarmups(movementId: string): Promise<LoggedSet[]> {
  const sessions = await db.sessions.orderBy('startedAt').reverse().toArray()
  for (const s of sessions) {
    if (s.finishedAt === null) continue
    const m = s.movements.find((x) => x.movementId === movementId)
    if (!m) continue
    const warmups = m.sets.filter((x) => x.done && x.kind === 'warmup')
    if (warmups.length) return warmups
  }
  return []
}

/** The note last left on this movement, so a cue carries to the next session. */
export async function previousNote(movementId: string): Promise<string | null> {
  const sessions = await db.sessions.orderBy('startedAt').reverse().toArray()
  for (const s of sessions) {
    if (s.finishedAt === null) continue
    const note = s.movements.find((m) => m.movementId === movementId)?.note
    if (note) return note
  }
  return null
}

/* --- starting ------------------------------------------------------------ */

/**
 * Copies the plan out of the template. Later edits to the template cannot
 * rewrite this session — that separation is required, not incidental.
 */
export async function startSession(
  template?: Template,
  /** The day to log against. Defaults to now; a past day logs retroactively. */
  at: number = Date.now(),
): Promise<string> {
  const retro = localDay(at) !== localDay(Date.now())
  const startedAt = retro ? noonOn(at) : Date.now()
  const session: Session = {
    id: id(),
    templateId: template?.id ?? null,
    templateName: template?.name ?? null,
    startedAt,
    startedLocalDay: localDay(startedAt),
    retro,
    finishedAt: null,
    movements: (template?.items ?? []).map((item) => ({
      uid: id(),
      movementId: item.movementId,
      targetReps: item.targetReps,
      plannedSets: item.sets,
      restSeconds: item.restSeconds,
      note: null,
      // Target reps come from the routine, so they fill; the load does not.
      sets: [{ ...emptySet(), reps: item.targetReps }],
    })),
  }

  // Loads are never pre-filled: the app must not assert a weight nobody lifted.
  // Target reps do carry over — they come from the routine the user picked, which
  // is a plan rather than an inference. See suggestionFor for the rest.
  for (const m of session.movements) {
    m.note = await previousNote(m.movementId)
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

/** Returns the new entry's uid so the caller can focus what was just added. */
export async function addMovement(
  sessionId: string,
  movementId: string,
): Promise<string> {
  const uid = id()
  const note = await previousNote(movementId)
  await mutate(sessionId, (s) => {
    s.movements.push({
      uid,
      movementId,
      targetReps: null,
      plannedSets: null,
      restSeconds: null,
      note,
      sets: [emptySet()],
    })
  })
  return uid
}

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

/** Delete a logged set. The draft is not deletable — it is the input. */
export const removeSet = (sessionId: string, mIndex: number, sIndex: number) =>
  mutate(sessionId, (s) => {
    const sets = s.movements[mIndex].sets
    if (!sets[sIndex]?.done) return
    sets.splice(sIndex, 1)
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

/**
 * Log the draft and open a fresh one. The app's most-repeated action.
 *
 * The next draft keeps the kind and the load just used, because mid-session the
 * obvious default is "same again" — re-deriving from history would ignore what
 * you actually just lifted. A warmup steps to the next rung of last session's
 * ramp when there is one, so a familiar ramp replays itself.
 *
 * The kind is never changed for you. Flipping to Työsarja is the user's call:
 * guessing that a ramp has finished would silently mislabel a warmup.
 */
export async function commitSet(sessionId: string, mIndex: number): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) return
  const movement = session.movements[mIndex]
  const draft = movement.sets.at(-1)
  if (!draft || draft.done) return

  // Both values must have been set. 0 counts — it means bodyweight, deliberately
  // recorded — but null means never entered, and there is nothing to log.
  const reps = draft.reps ?? movement.targetReps
  if (draft.kg === null || reps === null) return

  await mutate(sessionId, (s) => {
    const m = s.movements[mIndex]
    const set = m.sets.at(-1)
    if (!set || set.done) return
    set.done = true
    set.completedAt = Date.now()
    set.reps = reps

    // Blank again. What you just lifted becomes a suggestion, not a fact the app
    // records on your behalf.
    m.sets.push({
      ...emptySet(set.kind),
      reps: set.kind === 'working' ? m.targetReps : null,
    })
  })
}

/** Flip the draft between warmup and working. Values stay blank either way. */
export const setDraftKind = (sessionId: string, mIndex: number, kind: SetKind) =>
  mutate(sessionId, (s) => {
    const m = s.movements[mIndex]
    const draft = m.sets.at(-1)
    if (!draft || draft.done) return
    m.sets[m.sets.length - 1] = {
      ...emptySet(kind),
      reps: kind === 'working' ? m.targetReps : null,
    }
  })

export type SuggestionSource = 'progression' | 'repeat' | 'ramp'

export interface Suggestion {
  kg: number
  reps: number | null
  source: SuggestionSource
  /** Load this beats, when the suggestion is a progression step. */
  fromKg: number | null
}

/**
 * The inferred values for the set being entered — offered, never applied.
 *
 * Within a session the nearest evidence is the last set of the same kind you
 * actually logged; before that it is last session's warmup ramp, or what
 * progression proposes. Pure, so the screen can derive it from data it already
 * holds rather than querying again.
 */
export function suggestionFor(
  m: SessionMovement,
  kind: SetKind,
  ramp: LoggedSet[],
  proposal: { kg: number | null; reps: number | null; fromKg: number | null },
): Suggestion | null {
  const lastOfKind = m.sets.filter((s) => s.done && s.kind === kind).at(-1)
  if (lastOfKind?.kg !== undefined && lastOfKind.kg !== null) {
    return { kg: lastOfKind.kg, reps: lastOfKind.reps, source: 'repeat', fromKg: null }
  }
  if (kind === 'warmup') {
    const rung = ramp[warmupsDone(m).length]
    return rung?.kg === null || rung?.kg === undefined
      ? null
      : { kg: rung.kg, reps: rung.reps, source: 'ramp', fromKg: null }
  }
  if (proposal.kg === null) return null
  return {
    kg: proposal.kg,
    reps: proposal.reps ?? m.targetReps,
    source: 'progression',
    fromKg: proposal.fromKg,
  }
}

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
  // A session logged after the fact was never timed, so it claims no duration.
  session.finishedAt = session.retro ? session.startedAt : Date.now()
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
    order: Date.now(),
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

/**
 * Working sets against the routine's plan. Warmups are logged but excluded — they
 * are preparation, not the work, and letting them count would mean three warmups
 * "finished" a three-set movement.
 */
export function workingDone(m: SessionMovement): number {
  return m.sets.filter((s) => s.done && s.kind === 'working').length
}

export function warmupsDone(m: SessionMovement): LoggedSet[] {
  return m.sets.filter((s) => s.done && s.kind === 'warmup')
}

/**
 * Progress against the plan, with anything beyond it reported separately. A
 * sixth set on a five-set movement is "5/5 +1", not "6/5" — the plan is met and
 * you did extra, which are two facts rather than one confusing ratio. It also
 * keeps the session rail from exceeding its track.
 */
export function movementProgress(m: SessionMovement): {
  done: number
  total: number | null
  extra: number
} {
  const logged = workingDone(m)
  if (m.plannedSets === null) return { done: logged, total: null, extra: 0 }
  return {
    done: Math.min(logged, m.plannedSets),
    total: m.plannedSets,
    extra: Math.max(0, logged - m.plannedSets),
  }
}

export function movementComplete(m: SessionMovement): boolean {
  return m.plannedSets !== null && workingDone(m) >= m.plannedSets
}

export function sessionProgress(session: Session): {
  done: number
  total: number
  extra: number
} {
  let done = 0
  let total = 0
  let extra = 0
  for (const m of session.movements) {
    const p = movementProgress(m)
    done += p.done
    // A movement with no plan contributes its own logged sets, so the ratio
    // stays meaningful rather than counting work against nothing.
    total += p.total ?? p.done
    extra += p.extra
  }
  return { done, total, extra }
}

/** Index of the movement to focus: the first with sets still to log. */
export function firstIncomplete(session: Session): number | null {
  const i = session.movements.findIndex((m) => !movementComplete(m))
  return i === -1 ? null : i
}

/** The trailing draft — the set being entered. Absent on a finished session. */
export function draftIndex(m: SessionMovement): number | null {
  const i = m.sets.length - 1
  return i >= 0 && !m.sets[i].done ? i : null
}

export function draftSet(m: SessionMovement): LoggedSet | null {
  const i = draftIndex(m)
  return i === null ? null : m.sets[i]
}
