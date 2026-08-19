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
      await db.sessionFeedback.delete(session.id)
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

/** One past session's worth of a single movement, ready to render. */
export interface HistoryEntry {
  sessionId: string
  at: number
  /** Snapshot from the session, so a renamed routine does not relabel history. */
  templateName: string | null
  retro: boolean
  warmups: LoggedSet[]
  working: LoggedSet[]
  /** Heaviest working set, or the longest one when nothing carried a load. */
  topSet: LoggedSet | null
  volumeKg: number
  note: string | null
}

/**
 * Every finished session that logged this movement, newest first.
 *
 * A session can hold the same movement twice — the type comments on `uid` say so
 * — and the two entries are one day's work on that lift, so they merge into a
 * single row rather than reading as two separate sessions.
 */
export async function movementHistory(
  movementId: string,
  excludeSessionId?: string,
): Promise<HistoryEntry[]> {
  const sessions = await db.sessions.orderBy('startedAt').reverse().toArray()
  const out: HistoryEntry[] = []

  for (const s of sessions) {
    if (s.id === excludeSessionId || s.finishedAt === null) continue
    const entries = s.movements.filter((m) => m.movementId === movementId)
    if (!entries.length) continue

    const sets = entries.flatMap((m) => m.sets.filter((x) => x.done))
    if (!sets.length) continue
    const working = sets.filter((x) => x.kind === 'working')

    out.push({
      sessionId: s.id,
      at: s.startedAt,
      templateName: s.templateName,
      retro: Boolean(s.retro),
      warmups: sets.filter((x) => x.kind === 'warmup'),
      working,
      topSet: heaviest(working),
      volumeKg: Math.round(
        working.reduce((n, x) => n + (x.kg && x.reps ? x.kg * x.reps : 0), 0),
      ),
      note: entries.map((m) => m.note).find((n) => n) ?? null,
    })
  }
  return out
}

/**
 * The set that best represents a session's effort: heaviest load, reps breaking
 * the tie. Bodyweight work has no load to rank, so it falls back to reps —
 * otherwise a movement you have never loaded would report no best set at all.
 */
function heaviest(sets: LoggedSet[]): LoggedSet | null {
  if (!sets.length) return null
  const loaded = sets.filter((s) => s.kg !== null && s.kg > 0)
  const pool = loaded.length ? loaded : sets
  return pool.reduce((best, s) =>
    (s.kg ?? 0) !== (best.kg ?? 0)
      ? (s.kg ?? 0) > (best.kg ?? 0)
        ? s
        : best
      : (s.reps ?? 0) > (best.reps ?? 0)
        ? s
        : best,
  )
}

/**
 * Last session's warmup ramp for this movement. The counterpart to
 * previousPerformance, which deliberately looks at working sets only.
 *
 * It stops at the newest session containing the movement at all, rather than
 * searching back until it finds one that happened to have warmups. Warming up is
 * optional now, so most sessions will have none, and an unbounded search would
 * keep offering a ramp in absolute kilos from months ago — against a working load
 * that has since moved. The last time you trained it and did not warm up is an
 * answer, not a miss.
 */
export async function previousWarmups(movementId: string): Promise<LoggedSet[]> {
  const sessions = await db.sessions.orderBy('startedAt').reverse().toArray()
  for (const s of sessions) {
    if (s.finishedAt === null) continue
    const m = s.movements.find((x) => x.movementId === movementId)
    if (!m) continue
    return m.sets.filter((x) => x.done && x.kind === 'warmup')
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
      /* Opens on the work, with the routine's target reps already in it. The
         draft is never a warmup — a remembered ramp is logged whole from the
         session screen, and a one-off from the movement menu; see
         `applyWarmupRamp` and `addWarmupSet`. Opening on Lämmittely instead cost
         a mode decision before the first set of every movement, and needed an
         end-of-session check to catch the sets it silently excluded. */
      sets: [{ ...emptySet('working'), reps: item.targetReps }],
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
      // Same as a templated movement, minus the target: added ad hoc, it has no
      // plan to pre-fill from.
      sets: [emptySet('working')],
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

export interface CommitResult {
  /** Whether a set was written at all. */
  logged: boolean
  /**
   * Whether this set is the one that met the movement's plan.
   *
   * The *transition* into completion, not the state of being complete — so
   * returning later to add a sixth set to a five-set movement does not report it
   * again, and does not bounce you off a movement you came back to on purpose.
   */
  completedMovement: boolean
}

/**
 * Log the draft and open a fresh one. The app's most-repeated action.
 *
 * `fill` is what the tick affirmed when a field was left showing an offer rather
 * than a typed number. It is applied here, inside the commit's own transaction,
 * and only to fields still empty — writing it first and committing second would
 * be two transactions, and an interruption between them would leave inferred
 * numbers on disk that nobody ever affirmed.
 *
 * `completedMovement` is decided in here, against the row this transaction read,
 * because the screen cannot decide it safely. It used to predict the outcome from
 * its own render snapshot — `workingDone(movement) + 1 === plannedSets` — which
 * is only right if that snapshot is strictly pre-commit. Whether it is depends on
 * what the live query handed React and when, and getting it wrong fails silently
 * and permanently: the workout simply never advances. Before and after are both
 * known here, and neither is a guess.
 */
export async function commitSet(
  sessionId: string,
  mIndex: number,
  fill?: { kg: number | null; reps: number | null },
): Promise<CommitResult> {
  const result: CommitResult = { logged: false, completedMovement: false }
  await mutate(sessionId, (s) => {
    const m = s.movements[mIndex]
    const set = m.sets.at(-1)
    if (!set || set.done) return

    // Both values must resolve. 0 counts — it means bodyweight, deliberately
    // recorded — but null means never entered, and there is nothing to log. The
    // guard runs against the row read inside this transaction, not the one the
    // screen was looking at.
    const kg = set.kg ?? fill?.kg ?? null
    const reps = set.reps ?? fill?.reps ?? m.targetReps
    if (kg === null || reps === null) return

    const wasComplete = movementComplete(m)

    set.kg = kg
    set.reps = reps
    set.done = true
    set.completedAt = Date.now()

    // Blank again, and working again. What you just lifted becomes a suggestion,
    // not a fact the app records on your behalf.
    m.sets.push({ ...emptySet('working'), reps: m.targetReps })

    result.logged = true
    result.completedMovement = !wasComplete && movementComplete(m)
  })
  return result
}

/**
 * Where to go once the movement at `mIndex` is finished: the next one still
 * unfinished, wrapping round to earlier ones only when nothing is left ahead.
 *
 * The wrap is what makes this correct rather than merely forward-looking — an
 * occupied rack gets skipped and come back to, and after the last movement there
 * may still be a half-done one behind you. But it searches *forward first*, which
 * a bare `findIndex` from zero did not: finishing the second movement of three
 * sent you back to the first one you had deliberately left part-done, which reads
 * exactly like the advance being broken.
 */
export function nextMovementAfter(session: Session, mIndex: number): number | null {
  const n = session.movements.length
  for (let k = 1; k < n; k++) {
    const i = (mIndex + k) % n
    if (!movementComplete(session.movements[i])) return i
  }
  return null
}

/**
 * Log a remembered ramp in one go.
 *
 * Spliced in *before* the draft rather than pushed after it: the draft is the
 * input, and it may already hold numbers typed before the row was noticed.
 * Pushing and opening a fresh draft would throw those away.
 *
 * It refuses once anything is logged, which is also what makes a double tap
 * harmless — `mutate` re-reads inside its own transaction, so the second tap
 * sees the first one's writes even before the query repaints.
 */
export async function applyWarmupRamp(
  sessionId: string,
  mIndex: number,
  ramp: LoggedSet[],
): Promise<void> {
  const rungs = ramp.filter((r) => r.kg !== null)
  if (!rungs.length) return
  await mutate(sessionId, (s) => {
    const m = s.movements[mIndex]
    const at = draftIndex(m)
    if (at === null || m.sets.some((x) => x.done)) return
    // One instant for the whole ramp: these are asserted retroactively and a
    // timestamp per rung would be precision the app does not have. It cannot be
    // null — `lastActivityAt` reads it to decide when training actually stopped.
    const completedAt = Date.now()
    m.sets.splice(
      at,
      0,
      ...rungs.map((r) => ({
        kind: 'warmup' as SetKind,
        kg: r.kg,
        reps: r.reps,
        done: true,
        completedAt,
      })),
    )
  })
}

/**
 * Log the draft as a warmup rather than a working set.
 *
 * For a ramp the app did not remember. It takes the numbers already in the input
 * instead of asking for them again, and leaves a fresh working draft behind — so
 * there is no warmup *mode* to get stuck in, which is what made the old
 * segmented control need an end-of-session check to undo.
 */
export async function commitAsWarmup(
  sessionId: string,
  mIndex: number,
): Promise<boolean> {
  let logged = false
  await mutate(sessionId, (s) => {
    const m = s.movements[mIndex]
    const set = m.sets.at(-1)
    if (!set || set.done || set.kg === null || set.reps === null) return
    set.kind = 'warmup'
    set.done = true
    set.completedAt = Date.now()
    m.sets.push({ ...emptySet('working'), reps: m.targetReps })
    logged = true
  })
  return logged
}

/** Correct a logged set's kind, from the edit sheet. Drafts are never touched:
 *  the draft is always working, and that is the invariant everything else rests
 *  on. */
export const setLoggedKind = (
  sessionId: string,
  mIndex: number,
  sIndex: number,
  kind: SetKind,
) =>
  mutate(sessionId, (s) => {
    const set = s.movements[mIndex].sets[sIndex]
    if (set?.done) set.kind = kind
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
    await db.sessionFeedback.delete(sessionId)
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

/** Feedback is deleted with the session it describes — an answer about a
 *  workout that no longer exists is an orphan, and "Data export + delete" will
 *  eventually walk these tables expecting them to agree. */
export const discardSession = async (sessionId: string) => {
  await db.sessions.delete(sessionId)
  await db.sessionFeedback.delete(sessionId)
}

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

/**
 * Logged working sets. Everywhere a session reports "sarjaa", and the counterpart
 * to `volumeKg` and `sessionProgress`, which are both working-only.
 *
 * It used to count warmups too. That was survivable while every movement opened
 * on Lämmittely and the inflation was uniform; now that warming up is a choice, a
 * movement you ramped would score two or three sets above the same work without a
 * ramp, and the one-tap ramp row would read as if it padded your session.
 */
export function workingSetCount(session: Session): number {
  return session.movements.reduce((n, m) => n + workingDone(m), 0)
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
