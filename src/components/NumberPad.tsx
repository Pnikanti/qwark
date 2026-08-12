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
  label,
  onCommit,
  onClose,
}: {
  mode: PadMode
  value: number | null
  label: string
  onCommit: (value: number | null) => void | Promise<void>
  onClose: () => void
}) {
  const gym = useGym()
  const [draft, setDraft] = useState<string>(value === null ? '' : String(value))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') commit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const numeric = draft === '' ? null : Number(draft.replace(',', '.'))
  const step = mode === 'kg' ? stepKg(gym) : 1

  // Await the write before closing: the value must be on disk, not in flight,
  // before the sheet disappears and the app can be killed.
  const commit = async () => {
    await onCommit(numeric !== null && Number.isFinite(numeric) ? numeric : null)
    onClose()
  }

  const bump = (delta: number) => {
    const base = numeric ?? (mode === 'kg' ? gym.barKg : 0)
    const next = Math.max(0, Math.round((base + delta) * 100) / 100)
    setDraft(String(next))
  }

  const press = (key: string) => {
    if (key === 'del') return setDraft((d) => d.slice(0, -1))
    if (key === ',') return setDraft((d) => (d.includes('.') ? d : d + '.'))
    setDraft((d) => (d === '0' ? key : d + key))
  }

  const load = mode === 'kg' && numeric !== null ? platesFor(numeric, gym) : null

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
          <span className="readout-value">{draft.replace('.', ',') || '–'}</span>
          <span className="readout-unit t-data">{mode === 'kg' ? 'kg' : fi.reps}</span>
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
                  <button className="revert" onClick={() => setDraft(String(snapToBar(numeric!, gym)))}>
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
