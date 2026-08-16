import { db } from '../db'
import { snapLoad } from './plates'
import { progressionFor } from './progression'
import type { GymSettings, MovementAnswer, SessionFeedback, ShortfallCause } from '../types'
import type { DeloadEvent, DialogueContext } from './dialogue'
import { setsLine } from './format'

/** The script generation these rows were written by. */
const SCRIPT = 1

/**
 * At most this many movements are ever asked about in one session; the rest are
 * stated in a line. Against the twelve-week demo history three events in one
 * session happens well under one per cent of the time, so this is a guard for
 * the tail rather than a case anyone will meet.
 */
const MAX_ASKED = 3

export async function readFeedback(sessionId: string): Promise<SessionFeedback | undefined> {
  return db.sessionFeedback.get(sessionId)
}

/**
 * Answers commit on tap, like the session screen's tick — so dismissing the
 * sheet part-way keeps what was already answered and abandons only the question
 * still on screen. Re-answering overwrites; it never appends.
 */
export async function saveAnswer(
  sessionId: string,
  movementId: string,
  value: ShortfallCause,
): Promise<void> {
  const at = Date.now()
  const answer: MovementAnswer = { turn: 'shortfall', value, at }
  const existing = await db.sessionFeedback.get(sessionId)
  await db.sessionFeedback.put({
    sessionId,
    at,
    script: SCRIPT,
    answers: { ...(existing?.answers ?? {}), [movementId]: answer },
  })
}

/** Un-answering. The proposal falls back to whatever the rules alone decide. */
export async function clearAnswer(sessionId: string, movementId: string): Promise<void> {
  const existing = await db.sessionFeedback.get(sessionId)
  if (!existing) return
  const answers = { ...existing.answers }
  delete answers[movementId]
  if (Object.keys(answers).length === 0) {
    await db.sessionFeedback.delete(sessionId)
    return
  }
  await db.sessionFeedback.put({ ...existing, answers, at: Date.now() })
}

/** Paired into session deletion so answers cannot outlive what they describe. */
export async function dropFeedback(sessionId: string): Promise<void> {
  await db.sessionFeedback.delete(sessionId)
}

/**
 * Everything the dialogue needs, assembled from Dexie.
 *
 * The trigger predicate lives here rather than in the screen because whether
 * there is anything to say is a judgement about training data, not about
 * layout: Yhteenveto mounts the dialogue unconditionally and renders nothing
 * when this returns no events.
 *
 * An event is a movement where the rules are about to cut the load, and where
 * this session is the newest one containing that movement — the second clause
 * is what stops an old summary opened from Päivä raising a question that has
 * already been settled by later training.
 */
export async function buildDialogueContext(
  sessionId: string,
  gym: GymSettings,
): Promise<DialogueContext> {
  const session = await db.sessions.get(sessionId)
  if (!session) {
    return { sessionId, events: [], answers: {}, proposals: [] }
  }

  const stored = await db.sessionFeedback.get(sessionId)
  const newest = await newestSessionByMovement()

  const events: DeloadEvent[] = []
  const proposals: DialogueContext['proposals'] = []

  for (const m of session.movements) {
    const working = m.sets.filter((s) => s.done && s.kind === 'working')
    if (!working.length) continue

    // No `excludeSessionId`: this is the proposal the next session will actually
    // be offered, which is the number the dialogue has to be able to state.
    const p = await progressionFor(m.movementId, m.targetReps, gym)
    proposals.push({ movementId: m.movementId, p })

    // The event is what the *rules* decided, not what the answer left behind.
    // Reading `kind` alone was wrong in a way that hid itself: answering
    // "päivä oli huono" turns the proposal into a hold, so the question — and
    // with it the recorded answer — disappeared the instant it was answered.
    // `toldDay` arises only from a declined deload, so it marks the same event.
    const isDeload = p.kind === 'deload' || p.reason === 'toldDay'
    if (!isDeload) continue
    if (newest.get(m.movementId) !== sessionId) continue

    const missed = p.fromKg ?? 0
    events.push({
      movementId: m.movementId,
      atKg: missed,
      // What the rules propose with nothing said — stated in the question, so
      // it must stay the cut even once the cut has been declined.
      ruleKg: p.reason === 'toldDay' ? snapLoad(missed * 0.9, gym) : (p.kg ?? 0),
      targetReps: m.targetReps,
      line: setsLine(working),
    })
  }

  // Heaviest first: if only some can be asked about, ask about the big lifts.
  events.sort((a, b) => b.atKg - a.atKg)

  return {
    sessionId,
    events,
    answers: stored?.answers ?? {},
    proposals,
    asked: events.slice(0, MAX_ASKED).map((e) => e.movementId),
  }
}

/** movementId → the id of the newest finished session containing it. */
async function newestSessionByMovement(): Promise<Map<string, string>> {
  const sessions = await db.sessions.orderBy('startedAt').reverse().toArray()
  const out = new Map<string, string>()
  for (const s of sessions) {
    if (s.finishedAt === null) continue
    for (const m of s.movements) {
      if (!out.has(m.movementId) && m.sets.some((x) => x.done && x.kind === 'working')) {
        out.set(m.movementId, s.id)
      }
    }
  }
  return out
}
