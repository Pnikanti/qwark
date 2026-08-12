import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BodyPlan } from '../components/BodyPlan'
import { NewMovement } from '../components/NewMovement'
import { equipmentFi, fi, muscleFi, tax } from '../i18n'
import { listMovements, needsReview } from '../lib/movements'
import type { EffectiveMovement } from '../types'

interface Props {
  onEdit: (id: string) => void
  onBulkRename: () => void
  onOverrides: () => void
}

/** Groups the sorted list under its initial letter — the axis you actually scan. */
function byInitial(movements: EffectiveMovement[]) {
  const groups: { letter: string; items: EffectiveMovement[] }[] = []
  for (const m of movements) {
    const letter = (m.nameFi ?? m.nameEn).charAt(0).toUpperCase()
    const last = groups.at(-1)
    if (last?.letter === letter) last.items.push(m)
    else groups.push({ letter, items: [m] })
  }
  return groups
}

export function Library({ onEdit, onBulkRename, onOverrides }: Props) {
  const movements = useLiveQuery(listMovements, [])
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [withHidden, setWithHidden] = useState(false)
  const [creating, setCreating] = useState(false)

  const visible = useMemo(() => {
    if (!movements) return []
    const q = query.trim().toLowerCase()
    return movements
      .filter((m) => (withHidden ? true : !m.hidden))
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
  }, [movements, query, muscle, equipment, reviewOnly, withHidden])

  if (!movements) return <p className="blank note">{fi.loading}</p>

  const editedCount = movements.filter((m) => m.edited.size > 0).length
  const reviewCount = movements.filter(needsReview).length
  const groups = byInitial(visible)

  return (
    <>
      {creating && (
        <NewMovement
          onCreated={(created) => {
            setCreating(false)
            onEdit(created)
          }}
          onClose={() => setCreating(false)}
        />
      )}
      <header className="masthead">
        <h1 className="t-title">{fi.library}</h1>
        <span className="t-data">
          {fi.movementCount(visible.length)} · {fi.editedCount(editedCount)}
        </span>
        <div className="masthead-actions">
          <button className="btn" onClick={onBulkRename}>
            {fi.bulkRename}
          </button>
          <button className="btn" onClick={onOverrides}>
            {fi.overrides}
          </button>
          <button className="btn" onClick={() => setCreating(true)}>
            + {fi.newMovement}
          </button>
        </div>
      </header>

      <div className="controls">
        <input
          className="wide"
          type="search"
          placeholder={fi.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
          aria-label={fi.primaryMuscles}
        >
          <option value="">{fi.allMuscles}</option>
          {Object.keys(tax.muscles)
            .sort((a, b) => muscleFi(a).localeCompare(muscleFi(b), 'fi'))
            .map((key) => (
              <option key={key} value={key}>
                {muscleFi(key)}
              </option>
            ))}
        </select>
        <select
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          aria-label={fi.equipment}
        >
          <option value="">{fi.allEquipment}</option>
          {Object.keys(tax.equipment)
            .sort((a, b) => equipmentFi(a).localeCompare(equipmentFi(b), 'fi'))
            .map((key) => (
              <option key={key} value={key}>
                {equipmentFi(key)}
              </option>
            ))}
        </select>
        <div className="toggles wide">
          <button
            className="toggle marked"
            aria-pressed={reviewOnly}
            onClick={() => setReviewOnly((v) => !v)}
          >
            {fi.needsReview} {reviewCount}
          </button>
          <button
            className="toggle"
            aria-pressed={withHidden}
            onClick={() => setWithHidden((v) => !v)}
          >
            {fi.showHidden}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="blank">
          <span className="t-data">{fi.noResults}</span>
          <p className="note">{fi.noResultsHint}</p>
        </div>
      ) : (
        <ul className="ledger">
          {groups.map((group, gi) => (
            <li key={group.letter} style={{ animationDelay: `${Math.min(gi, 8) * 22}ms` }}>
              <h2 className="section-mark">{group.letter}</h2>
              <ul className="ledger">
                {group.items.map((m) => (
                  <li key={m.id}>
                    <Entry movement={m} onClick={() => onEdit(m.id)} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Entry({
  movement: m,
  onClick,
}: {
  movement: EffectiveMovement
  onClick: () => void
}) {
  const detail = [
    m.primaryMuscles.map(muscleFi).join(' · '),
    equipmentFi(m.equipment),
    m.nameFi ? m.nameEn : null,
  ]
    .filter(Boolean)
    .join('  ·  ')

  return (
    <button className={`entry${m.hidden ? ' dimmed' : ''}`} onClick={onClick}>
      <BodyPlan primary={m.primaryMuscles} secondary={m.secondaryMuscles} size={42} />
      <span className="grow">
        <span className={`t-name${m.nameFi ? '' : ' draft'}`}>
          {m.nameFi ?? m.nameEn}
        </span>
        <span className="t-data">{detail}</span>
      </span>
      <span className="rail">
        {'custom' in m && <span className="flagtag own">{fi.ownMovement}</span>}
      {needsReview(m) && <span className="flagtag">{fi.incomplete}</span>}
        {m.edited.size > 0 && <span className="pip" title={fi.edited} />}
      </span>
    </button>
  )
}
