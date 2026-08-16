import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { fi } from '../i18n'
import { kgLabel } from '../lib/format'
import type { DialogueContext, NameOf, Phraser, Turn } from '../lib/dialogue'
import { scripted, turnsFor } from '../lib/dialogue'
import type { ShortfallCause } from '../types'

/** Long enough to read as a response rather than a field validating. */
const TURN_DELAY = 360

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The conversational review, as a thread.
 *
 * Renders turns and collects answers. It **writes nothing** — the host applies
 * the consequence — which is what lets a language model be swapped in behind
 * the phraser without a line of this file changing.
 *
 * Turns are revealed one at a time behind a beat. That is not decoration: an
 * answer producing an instantaneous reply reads as a form validating a field
 * rather than as someone responding, and the live region needs a gap or its
 * announcement collides with the button press. When a model supplies the text
 * the wait becomes real and the same row does the same job.
 */
export function Dialogue({
  ctx,
  nameOf,
  onAnswer,
  onClear,
  onClose,
  phrase = scripted,
  /** Replay a settled thread with no beats — see `seeded` below. */
  instant = false,
}: {
  ctx: DialogueContext
  nameOf: NameOf
  onAnswer: (movementId: string, cause: ShortfallCause) => void | Promise<void>
  onClear: (movementId: string) => void | Promise<void>
  onClose: () => void
  phrase?: Phraser
  instant?: boolean
}) {
  const [all, setAll] = useState<Turn[]>([])
  const [shown, setShown] = useState(0)
  const [pending, setPending] = useState(false)
  const settled = useRef<HTMLLIElement>(null)
  /** Lets the build effect tell a first open from an answer landing. */
  const shownRef = useRef(0)

  // Replaying a conversation you already had, one turn at a time, would be
  // theatre — so a thread opened on settled answers appears whole.
  const seeded = instant || (ctx.events.length > 0 && ctx.events.every((e) => ctx.answers[e.movementId]))

  /**
   * Rebuilt whenever the answers change, not once on mount.
   *
   * Building once was wrong in a way worth recording: `turnsFor` folds the
   * recorded answer into each turn, so a thread held in a ref still believed
   * every question was unanswered and the settled row could never appear. The
   * phraser is re-run with it, which is free while it is the identity function
   * and is what a model would want anyway — new state, new wording.
   */
  useEffect(() => {
    let live = true
    void (async () => {
      const turns = await phrase(turnsFor(ctx, nameOf), ctx)
      if (!live) return
      setAll(turns)
      // Only the first build waits; later rebuilds are answers landing, and the
      // reveal count is advanced by `answer()` rather than here.
      setShown((n) => {
        if (n > 0) return Math.min(Math.max(n, 1), turns.length)
        if (seeded || reduced()) return turns.length
        return 0
      })
      if (shownRef.current === 0 && !seeded && !reduced()) {
        setPending(true)
        setTimeout(() => {
          if (!live) return
          setPending(false)
          setShown(1)
        }, TURN_DELAY)
      }
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.answers, ctx.events.length])

  shownRef.current = shown

  // Focus the row the answer just created. Without this, focus is orphaned to
  // <body> when the chips unmount — the real bug in a dynamic thread. This is
  // restore-in-place, not a jump: the reader reads the record you just made.
  useLayoutEffect(() => {
    settled.current?.focus()
  }, [ctx.answers])

  const answer = async (turn: Turn, cause: ShortfallCause) => {
    // The session turn spreads only a claim that is genuinely about the
    // session. "The weight was too heavy" is about one lift, so choosing it
    // here settles nothing and the per-movement turns still ask.
    if (turn.id === 'session') {
      if (cause === 'day' || cause === 'unsure') {
        for (const e of ctx.events) await onAnswer(e.movementId, cause)
      }
    } else {
      await onAnswer(turn.id, cause)
    }
    if (shown >= all.length) return
    setPending(true)
    setTimeout(
      () => {
        setPending(false)
        setShown((n) => n + 1)
      },
      reduced() ? 0 : TURN_DELAY,
    )
  }

  const turns = all.slice(0, Math.max(shown, seeded ? all.length : 0))

  return (
    <Sheet label={fi.nextTimeSheet} onClose={onClose}>
      <div className="sheet-head">
        <span className="t-data">{fi.nextTimeSheet}</span>
        <button className="revert" onClick={onClose}>
          {fi.close}
        </button>
      </div>

      <ol className="ledger thread" aria-live="polite" aria-busy={pending}>
        {/* Each turn is immediately followed by its own answer row, so the
            thread alternates question · answer · question down the page. */}
        {turns.map((turn) => (
          <Fragment key={turn.id}>
            <TurnRow turn={turn} onAnswer={answer} />
            {turn.answered && (
              <li ref={settled} tabIndex={-1} className="turn is-answer">
                <span className="turn-tag t-data">{fi.answerTag}</span>
                <span
                  className={`turn-value t-data${turn.overridden ? ' is-override' : ''}`}
                >
                  {turn.chips.find((c) => c.id === turn.answered)?.label}
                </span>
                <button className="revert turn-clear" onClick={() => onClear(turn.id)}>
                  {fi.clearAnswer}
                </button>
              </li>
            )}
          </Fragment>
        ))}
        {pending && (
          <li className="turn turn-wait" aria-hidden="true">
            <span />
            <span />
            <span />
          </li>
        )}
      </ol>

      <div className="next-loads">
        <span className="t-data">{fi.nextLoads}</span>
        {ctx.proposals.map(({ movementId, p }) => (
          <p className="next-load" key={movementId}>
            <span className="grow t-name">{nameOf(movementId)}</span>
            <span className="next-load-kg t-data">
              {p.kg === null ? fi.nextNoProposal : `${kgLabel(p.kg)} kg`}
            </span>
          </p>
        ))}
        <p className="note field-note">{fi.proposalsAreOffers}</p>
      </div>
    </Sheet>
  )
}

/** One app turn: what it says, what it asks, and the chips to answer with. */
function TurnRow({
  turn,
  onAnswer,
}: {
  turn: Turn
  onAnswer: (turn: Turn, cause: ShortfallCause) => void
}) {
  const askId = `ask-${turn.id}`
  return (
    <li className="turn">
      {turn.says.map((line, i) => (
        <p className="turn-say" key={i}>
          {line}
        </p>
      ))}
      {turn.reply && <p className="turn-say">{turn.reply}</p>}
      {turn.asks && !turn.answered && (
        <>
          <p className="turn-ask" id={askId}>
            {turn.asks}
          </p>
          {/* Buttons, not toggles: an answer is an act, not a state. No
              aria-pressed at all — "not pressed" would make an unanswered
              question sound answered, which is the failure Choice.tsx names. */}
          <div className="chipset roomy" role="group" aria-labelledby={askId}>
            {turn.chips.map((chip) => (
              <button
                type="button"
                className="toggle"
                key={chip.id}
                onClick={() => onAnswer(turn, chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </>
      )}
    </li>
  )
}
