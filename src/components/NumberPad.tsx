import { useEffect, useState } from 'react'
import { fi } from '../i18n'
import { discToken, platesFor, snapToBar, stepKg } from '../lib/plates'
import { useGym } from '../lib/settings'

export type PadMode = 'kg' | 'reps'

/**
 * The control that gets used more than every other one combined, so it is a
 * purpose-built sheet rather than the OS keyboard: big targets, plate-sized
 * steppers, and a live plate breakdown so you know what to load.
 */
export function NumberPad({
  mode,
  value,
  hint,
  label,
  onCommit,
  onClose,
}: {
  mode: PadMode
  value: number | null
  /** The inferred load to show greyed when nothing is stored yet. Never written. */
  hint: number | null
  label: string
  /** The user affirmed a value. The parent owns the sheet from here. */
  onCommit: (value: number | null) => void | Promise<void>
  /** Dismissed. Nothing was affirmed and nothing is written. */
  onClose: () => void
}) {
  const gym = useGym()
  /**
   * The draft starts empty even when a value is stored, and `pristine` says so.
   * Seeding the draft with the value was what made typing append — open on 60,
   * tap 8, get 608 — because a stored number and a typed one were the same
   * string. Keeping them apart is what lets the first keystroke replace.
   */
  const [draft, setDraft] = useState('')
  const [pristine, setPristine] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') commit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const typed = draft === '' ? null : Number(draft.replace(',', '.'))
  /** What is stored, or failing that what is merely offered. */
  const ghost = value ?? hint
  /** An offer is dashed; a stored value is not. Solid means you entered it. */
  const ghostIsOffer = value === null && hint !== null
  /** The number the plate breakdown and the steppers work from. */
  const shown = pristine ? ghost : typed
  const step = mode === 'kg' ? stepKg(gym) : 1

  // Await the write before closing: the value must be on disk, not in flight,
  // before the sheet disappears and the app can be killed.
  const commit = async () => {
    // Nothing was touched, so nothing is asserted — least of all a load the app
    // inferred. Dismissing is the honest outcome; `Täytä` is how an offer is
    // accepted, and it is a deliberate tap on the offer itself.
    if (pristine) return onClose()
    await onCommit(typed !== null && Number.isFinite(typed) ? typed : null)
  }

  /** Adopt whatever is on screen as the starting point for an edit. */
  const materialise = () => {
    setPristine(false)
    return pristine ? (ghost === null ? '' : String(ghost)) : draft
  }

  const bump = (delta: number) => {
    const base = shown ?? (mode === 'kg' ? gym.barKg : 0)
    setPristine(false)
    setDraft(String(Math.max(0, Math.round((base + delta) * 100) / 100)))
  }

  const press = (key: string) => {
    // Editing keys work on what you can see; digits start over. Without the
    // first branch, ⌫ on a ghost would read as a dead key.
    if (key === 'del') return setDraft(materialise().slice(0, -1))
    if (key === ',') {
      const d = materialise()
      return setDraft(d.includes('.') ? d : (d || '0') + '.')
    }
    setDraft(pristine ? key : draft + key)
    setPristine(false)
  }

  const load = mode === 'kg' && shown !== null ? platesFor(shown, gym) : null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <span className="t-data">{label}</span>
          <button className="revert" onClick={onClose}>
            {fi.close}
          </button>
        </div>

        <div className="readout">
          <span
            className={`readout-value${pristine && ghost !== null ? ' is-ghost' : ''}${
              pristine && ghostIsOffer ? ' is-offer' : ''
            }`}
            /* A screen reader must not be told the field holds a number it does
               not hold, so the ghost announces itself as an offer. */
            aria-label={
              pristine && ghost !== null
                ? `${ghostIsOffer ? fi.padOffer : fi.padCurrent} ${ghost}`
                : undefined
            }
          >
            {(pristine ? (ghost === null ? '' : String(ghost)) : draft).replace('.', ',') || '–'}
          </span>
          <span className="readout-unit t-data">{mode === 'kg' ? 'kg' : fi.reps}</span>
          {pristine && ghost !== null && (
            <span className="readout-source t-data">
              {ghostIsOffer ? fi.padOffer : fi.padCurrent}
            </span>
          )}
        </div>

        {mode === 'kg' && (
          <div className="plates" aria-live="polite">
            {load === null ? (
              <span className="t-data">{fi.plateHintBelowBar(gym.barKg)}</span>
            ) : (
              <>
                <span className="t-data">{fi.perSide}</span>
                {load.perSide.length === 0 ? (
                  <span className="t-data">{fi.barOnly}</span>
                ) : (
                  load.perSide.map((disc, i) => (
                    <span
                      className="disc"
                      key={i}
                      style={{ background: discToken(disc), color: disc >= 10 ? '#fff' : '#111' }}
                    >
                      {disc}
                    </span>
                  ))
                )}
                {load.remainder > 0 && (
                  <button
                    className="revert"
                    onClick={() => {
                      setPristine(false)
                      setDraft(String(snapToBar(shown!, gym)))
                    }}
                  >
                    {fi.snapToBar(load.remainder)}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className="steppers">
          <button className="btn" onClick={() => bump(-step * 2)}>
            −{step * 2}
          </button>
          <button className="btn" onClick={() => bump(-step)}>
            −{step}
          </button>
          <button className="btn" onClick={() => bump(step)}>
            +{step}
          </button>
          <button className="btn" onClick={() => bump(step * 2)}>
            +{step * 2}
          </button>
        </div>

        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
            <button key={k} className="key" onClick={() => press(k)}>
              {k}
            </button>
          ))}
          <button
            className="key"
            onClick={() => press(',')}
            disabled={mode === 'reps'}
            aria-label={fi.decimal}
          >
            ,
          </button>
          <button className="key" onClick={() => press('0')}>
            0
          </button>
          <button className="key" onClick={() => press('del')} aria-label={fi.deleteDigit}>
            ⌫
          </button>
        </div>

        <button className="btn solid btn-tall sheet-commit" onClick={commit}>
          {fi.done}
        </button>
      </div>
    </div>
  )
}
