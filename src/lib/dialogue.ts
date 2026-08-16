import { fi } from '../i18n'
import { kgLabel } from './format'
import type { MovementAnswer, ShortfallCause } from '../types'
import type { Progression } from './progression'

/**
 * The conversational review, as data.
 *
 * This module is pure: no React, no Dexie, no fetch. That is the seam. The
 * thread component knows a list of turns; it does not know whether a turn came
 * out of the rule table below or out of a language model, and it must never
 * learn — an LLM would replace `Phraser`, not anything downstream of it.
 *
 * The invariant that makes the offline path the base case rather than a
 * fallback: **the model may choose words; it may not choose what happens.**
 * Consequences are decided by `afterAnswer` in progression.ts, from the answer
 * id, which no phraser is allowed to change.
 */

export interface Chip {
  /** Stable across every rewording. What a rule keys on. */
  id: ShortfallCause
  label: string
}

export interface Turn {
  /** Stable id. For a movement question this is the movementId. */
  id: string
  /** What the app states before asking. Plain strings, never JSX. */
  says: string[]
  /** The question, or null when this turn only states something. */
  asks: string | null
  chips: Chip[]
  /** The chip already recorded for this turn, if any. */
  answered: ShortfallCause | null
  /** Shown once an answer exists: what the answer changed. */
  reply: string | null
  /** True when the recorded answer overrode the rules — the row takes --mark. */
  overridden: boolean
}

export interface DeloadEvent {
  movementId: string
  /** The load that was missed twice. */
  atKg: number
  /** What the rules propose if nothing is said. */
  ruleKg: number
  targetReps: number | null
  /** The shortfall performance, already rendered by `setsLine`. */
  line: string
}

export interface DialogueContext {
  sessionId: string
  events: DeloadEvent[]
  answers: Record<string, MovementAnswer>
  proposals: { movementId: string; p: Progression }[]
  /** The movements actually asked about; the rest are stated in one line. */
  asked?: string[]
}

/** Resolves a movementId to its Finnish name. Supplied by the screen. */
export type NameOf = (movementId: string) => string

/**
 * The whole conversation, in order. Pure and total.
 *
 * With one event the thread asks about that lift directly — a "how did the
 * session go" preamble before drilling into the only lift that stalled is a
 * wasted tap. With two or more it opens session-level, because the causes
 * differ in scope: "the day was bad" is a claim about the session and applies
 * to all of them honestly, while "the weight was too heavy" is a claim about
 * one lift and cannot be spread.
 */
export function turnsFor(ctx: DialogueContext, nameOf: NameOf): Turn[] {
  const asked = ctx.asked ?? ctx.events.map((e) => e.movementId)
  const events = ctx.events.filter((e) => asked.includes(e.movementId))
  if (!events.length) return []

  const turns: Turn[] = events.map((e) => movementTurn(e, ctx, nameOf))

  if (events.length > 1) {
    turns.unshift(sessionTurn(events, ctx, nameOf))
  }

  const rest = ctx.events.filter((e) => !asked.includes(e.movementId))
  if (rest.length) {
    turns.push({
      id: 'rest',
      says: [fi.shortfallRest(rest.map((e) => nameOf(e.movementId)).join(', '))],
      asks: null,
      chips: [],
      answered: null,
      reply: null,
      overridden: false,
    })
  }

  return turns
}

const CHIPS: Chip[] = [
  { id: 'load', label: fi.causeLoad },
  { id: 'day', label: fi.causeDay },
  { id: 'unsure', label: fi.causeUnsure },
]

/**
 * The session-level opener, shown only when more than one lift stalled.
 *
 * Its answer is written to every stalled movement at once — which is only
 * honest because of what the chips mean. `day` is a claim about the session, so
 * spreading it is correct. `load` is a claim about one lift, so choosing it
 * here does not settle anything: the per-movement turns below still ask.
 */
function sessionTurn(events: DeloadEvent[], ctx: DialogueContext, nameOf: NameOf): Turn {
  const names = events.map((e) => nameOf(e.movementId)).join(', ')
  const answers = events.map((e) => ctx.answers[e.movementId]?.value)
  const all = answers.every((a) => a !== undefined && a === answers[0]) ? answers[0] : null

  return {
    id: 'session',
    says: [fi.shortfallMany(names)],
    asks: fi.askShortfall,
    chips: CHIPS,
    answered: all ?? null,
    reply: all === 'day' ? fi.replyManyDay : null,
    overridden: all === 'day',
  }
}

function movementTurn(e: DeloadEvent, ctx: DialogueContext, nameOf: NameOf): Turn {
  const name = nameOf(e.movementId)
  const answer = ctx.answers[e.movementId]?.value ?? null

  const says = [
    e.targetReps !== null
      ? fi.shortfallSeen(name, e.line, e.targetReps)
      : fi.shortfallSeenNoTarget(name, e.line),
    fi.shortfallTwice(kgLabel(e.ruleKg)),
  ]

  // The reply states the number the next session will actually offer. It is
  // read from the proposal rather than recomputed, so the sheet and the session
  // screen cannot disagree about what was decided.
  const kg = ctx.proposals.find((p) => p.movementId === e.movementId)?.p.kg ?? e.ruleKg
  const reply =
    answer === 'day'
      ? fi.replyCauseDay(kgLabel(kg))
      : answer === 'load'
        ? fi.replyCauseLoad(kgLabel(kg))
        : answer === 'unsure'
          ? fi.replyCauseUnsure(kgLabel(kg))
          : null

  return {
    id: e.movementId,
    says,
    asks: fi.askShortfall,
    chips: CHIPS,
    answered: answer,
    reply,
    overridden: answer === 'day',
  }
}

/**
 * Turns in, turns out.
 *
 * `scripted` is the identity function, so today this costs nothing — but the
 * call site awaits it from day one, which is the single decision that avoids a
 * rewrite when the turns start arriving over a network instead.
 */
export type Phraser = (turns: Turn[], ctx: DialogueContext) => Promise<Turn[]>

export const scripted: Phraser = async (turns) => turns
