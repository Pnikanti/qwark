import { useState } from 'react'
import { equipmentFi, fi, muscleFi, tax } from '../i18n'
import { createMovement } from '../lib/movements'
import { toast } from '../lib/toast'

/**
 * Minimum viable movement: a Finnish name is the only requirement. Everything
 * else can be filled in later from the library, and demanding it up front would
 * make adding a machine mid-session slower than skipping the log entirely.
 */
export function NewMovement({
  onCreated,
  onClose,
}: {
  onCreated: (id: string) => void
  onClose: () => void
}) {
  const [nameFi, setNameFi] = useState('')
  const [primary, setPrimary] = useState<string[]>([])
  const [equipment, setEquipment] = useState<string | null>(null)

  const submit = async () => {
    if (!nameFi.trim()) return
    const id = await createMovement({ nameFi, primaryMuscles: primary, equipment })
    toast(fi.movementCreated(nameFi.trim()))
    onCreated(id)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={fi.newMovement}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <span className="t-data">{fi.newMovement}</span>
          <button className="revert" onClick={onClose}>
            {fi.close}
          </button>
        </div>

        <div className="field">
          <div className="field-label">
            <span className="t-data">{fi.nameFi}</span>
          </div>
          <input
            autoFocus
            value={nameFi}
            placeholder={fi.newMovementPlaceholder}
            onChange={(e) => setNameFi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
        </div>

        <div className="field">
          <div className="field-label">
            <span className="t-data">{fi.equipment}</span>
          </div>
          <select
            value={equipment ?? ''}
            onChange={(e) => setEquipment(e.target.value || null)}
          >
            <option value="">–</option>
            {Object.keys(tax.equipment)
              .sort((a, b) => equipmentFi(a).localeCompare(equipmentFi(b), 'fi'))
              .map((key) => (
                <option key={key} value={key}>
                  {equipmentFi(key)}
                </option>
              ))}
          </select>
        </div>

        <div className="field">
          <div className="field-label">
            <span className="t-data">{fi.primaryMuscles}</span>
          </div>
          <div className="chipset">
            {Object.keys(tax.muscles)
              .sort((a, b) => muscleFi(a).localeCompare(muscleFi(b), 'fi'))
              .map((key) => (
                <button
                  key={key}
                  className="toggle"
                  aria-pressed={primary.includes(key)}
                  onClick={() =>
                    setPrimary((sel) =>
                      sel.includes(key)
                        ? sel.filter((k) => k !== key)
                        : [...sel, key].sort(),
                    )
                  }
                >
                  {muscleFi(key)}
                </button>
              ))}
          </div>
        </div>

        <button
          className="btn solid btn-tall sheet-commit"
          disabled={!nameFi.trim()}
          onClick={submit}
        >
          {fi.create}
        </button>
      </div>
    </div>
  )
}
