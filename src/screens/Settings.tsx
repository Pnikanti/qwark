import { useEffect, useState } from 'react'
import { fi } from '../i18n'
import { stepKg } from '../lib/plates'
import { DEFAULT_GYM, KNOWN_DISCS, readGym, writeGym } from '../lib/settings'
import { toast } from '../lib/toast'
import type { GymSettings } from '../types'

/**
 * The gym's actual hardware. Three things derive from it — the plate breakdown,
 * the pad's steppers, and the smallest progression step — so a wrong value makes
 * the app confidently misleading rather than merely imprecise.
 */
export function Settings({ onBack }: { onBack: () => void }) {
  const [gym, setGym] = useState<GymSettings | null>(null)

  useEffect(() => {
    readGym().then(setGym)
  }, [])

  if (!gym) return <p className="blank note">{fi.loading}</p>

  const save = async (next: GymSettings) => {
    setGym(next)
    await writeGym(next)
  }

  const toggleDisc = (disc: number) => {
    const has = gym.discs.includes(disc)
    const discs = has ? gym.discs.filter((d) => d !== disc) : [...gym.discs, disc]
    // Removing the last disc would make every load unreachable.
    if (!discs.length) {
      toast(fi.needOneDisc, { tone: 'warn' })
      return
    }
    save({ ...gym, discs: discs.sort((a, b) => b - a) })
  }

  return (
    <>
      <header className="masthead">
        <button className="back" onClick={onBack}>
          ← {fi.back}
        </button>
        <h1 className="t-title">{fi.settings}</h1>
        <span className="t-data">{fi.gymSetup}</span>
      </header>

      <div className="panel">
        <div className="field">
          <div className="field-label">
            <span className="t-data">{fi.barWeight}</span>
          </div>
          <div className="bar-row">
            {[20, 15, 10, 7].map((kg) => (
              <button
                key={kg}
                className="toggle"
                aria-pressed={gym.barKg === kg}
                onClick={() => save({ ...gym, barKg: kg })}
              >
                {kg} kg
              </button>
            ))}
          </div>
          <input
            className="bar-custom"
            type="number"
            inputMode="decimal"
            min={1}
            step={0.5}
            value={gym.barKg}
            aria-label={fi.barWeight}
            onChange={(e) => {
              const kg = Number(e.target.value)
              if (kg > 0) save({ ...gym, barKg: kg })
            }}
          />
        </div>
      </div>

      <div className="panel">
        <div className="field">
          <div className="field-label">
            <span className="t-data">{fi.availableDiscs}</span>
          </div>
          <div className="chipset">
            {KNOWN_DISCS.map((disc) => (
              <button
                key={disc}
                className="toggle"
                aria-pressed={gym.discs.includes(disc)}
                onClick={() => toggleDisc(disc)}
              >
                {disc}
              </button>
            ))}
          </div>
        </div>
        <p className="note">{fi.smallestStep(stepKg(gym))}</p>
      </div>

      <div className="panel">
        <div className="row-actions">
          <button
            className="btn"
            onClick={() => {
              save(DEFAULT_GYM)
              toast(fi.restoredDefaults)
            }}
          >
            {fi.restoreDefaults}
          </button>
        </div>
      </div>
    </>
  )
}
