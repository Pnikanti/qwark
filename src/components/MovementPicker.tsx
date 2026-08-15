import { useMemo, useState } from 'react'
import { BodyPlan } from './BodyPlan'
import { NewMovement } from './NewMovement'
import { equipmentFi, fi, muscleFi } from '../i18n'
import type { EffectiveMovement } from '../types'

/**
 * Picker for adding a movement mid-session. On a first run there are no recents,
 * so the list leads with the common compounds rather than showing a blank panel.
 */
const SUGGESTED = [
  'barbell-squat',
  'barbell-deadlift',
  'barbell-bench-press-medium-grip',
  'standing-military-press',
  'bent-over-barbell-row',
  'pullups',
]

export function MovementPicker({
  movements,
  onPick,
  onClose,
}: {
  movements: EffectiveMovement[]
  onPick: (movementId: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = movements.filter((m) => !m.hidden)
    if (!q) {
      const suggested = SUGGESTED.map((id) => pool.find((m) => m.id === id)).filter(
        Boolean,
      ) as EffectiveMovement[]
      const rest = pool
        .filter((m) => !SUGGESTED.includes(m.id))
        .sort((a, b) => (a.nameFi ?? a.nameEn).localeCompare(b.nameFi ?? b.nameEn, 'fi'))
      return [...suggested, ...rest]
    }
    return pool
      .filter(
        (m) =>
          (m.nameFi ?? '').toLowerCase().includes(q) ||
          m.nameEn.toLowerCase().includes(q),
      )
      .sort((a, b) => (a.nameFi ?? a.nameEn).localeCompare(b.nameFi ?? b.nameEn, 'fi'))
  }, [movements, query])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet tall"
        role="dialog"
        aria-modal="true"
        aria-label={fi.addMovement}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <span className="t-data">{fi.addMovement}</span>
          <button className="revert" onClick={onClose}>
            {fi.close}
          </button>
        </div>
        <div className="sheet-search">
          <input
            type="search"
            autoFocus
            placeholder={fi.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {creating && (
          <NewMovement onCreated={onPick} onClose={() => setCreating(false)} />
        )}
        <ul className="ledger scroller">
          {rows.map((m) => (
            <li key={m.id}>
              <button className="entry" onClick={() => onPick(m.id)}>
                <BodyPlan primary={m.primaryMuscles} secondary={m.secondaryMuscles} size={34} />
                <span className="grow">
                  <span className="t-name">{m.nameFi ?? m.nameEn}</span>
                  {/* Assembled from the parts that exist: a bodyweight movement
                      has no equipment, and a fixed separator left it as "· –". */}
                  <span className="t-data">
                    {[...m.primaryMuscles.map(muscleFi), equipmentFi(m.equipment)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {rows.length === 0 && <li className="blank note">{fi.noResults}</li>}
          <li className="picker-create">
            <button className="btn btn-tall" onClick={() => setCreating(true)}>
              + {fi.createMovement}
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
