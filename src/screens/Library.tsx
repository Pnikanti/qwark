import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { equipmentFi, fi, muscleFi, tax } from '../i18n'
import { listMovements, needsReview } from '../lib/movements'
import type { EffectiveMovement } from '../types'

interface Props {
  onEdit: (id: string) => void
  onBulkTranslate: () => void
  onExport: () => void
}

export function Library({ onEdit, onBulkTranslate, onExport }: Props) {
  const movements = useLiveQuery(listMovements, [])
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [showHidden, setShowHidden] = useState(false)

  const visible = useMemo(() => {
    if (!movements) return []
    const q = query.trim().toLowerCase()
    return movements
      .filter((m) => (showHidden ? true : !m.hidden))
      .filter((m) =>
        q
          ? (m.nameFi ?? '').toLowerCase().includes(q) ||
            m.nameEn.toLowerCase().includes(q)
          : true,
      )
      .filter((m) =>
        muscle
          ? m.primaryMuscles.includes(muscle) || m.secondaryMuscles.includes(muscle)
          : true,
      )
      .filter((m) => (equipment ? m.equipment === equipment : true))
      .filter((m) => (reviewOnly ? needsReview(m) : true))
      .sort((a, b) =>
        (a.nameFi ?? a.nameEn).localeCompare(b.nameFi ?? b.nameEn, 'fi'),
      )
  }, [movements, query, muscle, equipment, reviewOnly, showHidden])

  const editedCount = movements?.filter((m) => m.edited.size > 0).length ?? 0
  const reviewCount = movements?.filter(needsReview).length ?? 0

  if (!movements) return <p className="note">{fi.loading}</p>

  return (
    <>
      <div className="topbar">
        <h1>
          {fi.library}
          <br />
          <span className="sub">
            {editedCount > 0 ? fi.overrideCount(editedCount) : fi.noOverrides}
          </span>
        </h1>
        <button className="small" onClick={onBulkTranslate}>
          {fi.bulkTranslate}
        </button>
        <button className="small" onClick={onExport}>
          {fi.export}
        </button>
      </div>

      <div className="filters">
        <input
          className="wide"
          type="search"
          placeholder={fi.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">{fi.allMuscles}</option>
          {Object.keys(tax.muscles)
            .sort((a, b) => muscleFi(a).localeCompare(muscleFi(b), 'fi'))
            .map((key) => (
              <option key={key} value={key}>
                {muscleFi(key)}
              </option>
            ))}
        </select>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          <option value="">{fi.allEquipment}</option>
          {Object.keys(tax.equipment)
            .sort((a, b) => equipmentFi(a).localeCompare(equipmentFi(b), 'fi'))
            .map((key) => (
              <option key={key} value={key}>
                {equipmentFi(key)}
              </option>
            ))}
        </select>
      </div>

      <div className="chips">
        <button
          className="chip"
          aria-pressed={reviewOnly}
          onClick={() => setReviewOnly((v) => !v)}
        >
          {fi.needsReview} ({reviewCount})
        </button>
        <button
          className="chip"
          aria-pressed={showHidden}
          onClick={() => setShowHidden((v) => !v)}
        >
          {fi.showHidden}
        </button>
      </div>

      <p className="count">{fi.results(visible.length)}</p>

      {visible.length === 0 ? (
        <p className="note">{fi.noResults}</p>
      ) : (
        <ul className="list">
          {visible.map((m) => (
            <li key={m.id}>
              <MovementRow movement={m} onClick={() => onEdit(m.id)} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function MovementRow({
  movement: m,
  onClick,
}: {
  movement: EffectiveMovement
  onClick: () => void
}) {
  const muscles = m.primaryMuscles.map(muscleFi).join(', ')
  return (
    <button
      className={`row${m.hidden ? ' is-hidden' : ''}`}
      onClick={onClick}
      aria-label={`${fi.edit}: ${m.nameFi ?? m.nameEn}`}
    >
      <span className="grow">
        <span className={`name${m.nameFi ? '' : ' untranslated'}`}>
          {m.nameFi ?? m.nameEn}
        </span>
        <br />
        <span className="meta">
          {[muscles, equipmentFi(m.equipment), m.nameFi ? m.nameEn : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      {needsReview(m) && <span className="tag warn">{fi.missing}</span>}
      {m.edited.size > 0 && <span className="dot" title={fi.edited} />}
    </button>
  )
}
