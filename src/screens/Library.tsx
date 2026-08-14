import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BodyPlan } from '../components/BodyPlan'
import { NewMovement } from '../components/NewMovement'
import { equipmentFi, fi, muscleFi, tax } from '../i18n'
import { setsLine } from '../lib/format'
import { listMovements, needsReview } from '../lib/movements'
import { readUi, useUi, writeUi } from '../lib/settings'
import { movementStats, type MovementStat } from '../lib/stats'
import type { EffectiveMovement } from '../types'

interface Props {
  onEdit: (id: string) => void
  onBulkRename: () => void
  onOverrides: () => void
}

/** How many trained movements the top section shows before it folds. */
const TRAINED_PREVIEW = 6

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

/**
 * Browsing the movement library, with the editing controls behind a mode switch.
 *
 * The screen used to open with three admin buttons above the search box — bulk
 * rename, override export, new movement — and rails carrying `incomplete` flags
 * and edited pips. All of that is about the canonical data. None of it is what
 * you open the library for, and none of it answered the obvious question: which
 * of these 68 have I actually done?
 *
 * So the rail carries your training instead, the trained movements come first,
 * and everything to do with maintaining the data sits under `Hallinta`.
 */
export function Library({ onEdit, onBulkRename, onOverrides }: Props) {
  const movements = useLiveQuery(listMovements, [])
  const stats = useLiveQuery(movementStats, [])
  const { admin } = useUi()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [trainedOnly, setTrainedOnly] = useState(false)
  const [reviewOnly, setReviewOnly] = useState(false)
  const [withHidden, setWithHidden] = useState(false)
  const [creating, setCreating] = useState(false)
  const [allTrained, setAllTrained] = useState(false)

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
      .filter((m) => (trainedOnly ? Boolean(stats?.get(m.id)) : true))
      .filter((m) => (reviewOnly ? needsReview(m) : true))
      .sort((a, b) =>
        (a.nameFi ?? a.nameEn).localeCompare(b.nameFi ?? b.nameEn, 'fi'),
      )
  }, [movements, stats, query, muscle, equipment, trainedOnly, reviewOnly, withHidden])

  /* Trained first, most recent at the top, then everything else alphabetically.
     Searching collapses the split: when you have typed a name you want one list
     of matches, not your history and then the rest of the alphabet. */
  const searching = query.trim().length > 0 || trainedOnly
  const trained = useMemo(
    () =>
      searching || !stats
        ? []
        : visible
            .filter((m) => stats.get(m.id))
            .sort((a, b) => (stats.get(b.id)!.lastAt - stats.get(a.id)!.lastAt)),
    [visible, stats, searching],
  )
  const rest = useMemo(
    () => (searching || !stats ? visible : visible.filter((m) => !stats.get(m.id))),
    [visible, stats, searching],
  )

  if (!movements) return <p className="blank note">{fi.loading}</p>

  const editedCount = movements.filter((m) => m.edited.size > 0).length
  const reviewCount = movements.filter(needsReview).length
  const trainedCount = movements.filter((m) => stats?.get(m.id)).length
  const shownTrained = allTrained ? trained : trained.slice(0, TRAINED_PREVIEW)
  const hiddenTrained = trained.length - shownTrained.length

  const row = (m: EffectiveMovement) => (
    <li key={m.id}>
      <Entry
        movement={m}
        stat={stats?.get(m.id) ?? null}
        admin={admin}
        onClick={() => onEdit(m.id)}
      />
    </li>
  )

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
        <div className="masthead-top">
          <span className="grow">
            <h1 className="t-title">{fi.library}</h1>
          </span>
        </div>
        <span className="t-data">
          {fi.movementCount(visible.length)} ·{' '}
          {admin ? fi.editedCount(editedCount) : fi.trainedCount(trainedCount)}
        </span>

        {/* The mode switch is always here; what it reveals is not. */}
        <div className="masthead-actions">
          <button
            className="btn"
            aria-pressed={admin}
            onClick={async () => writeUi({ ...(await readUi()), admin: !admin })}
          >
            {admin ? fi.doneEditing : fi.manage}
          </button>
          {admin && (
            <>
              <button className="btn" onClick={onBulkRename}>
                {fi.bulkRename}
              </button>
              <button className="btn" onClick={onOverrides}>
                {fi.overrides}
              </button>
            </>
          )}
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
          {trainedCount > 0 && (
            <button
              className="toggle"
              aria-pressed={trainedOnly}
              onClick={() => setTrainedOnly((v) => !v)}
            >
              {fi.trainedOnly} {trainedCount}
            </button>
          )}
          {admin && (
            <button
              className="toggle marked"
              aria-pressed={reviewOnly}
              onClick={() => setReviewOnly((v) => !v)}
            >
              {fi.needsReview} {reviewCount}
            </button>
          )}
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
        <>
          {trained.length > 0 && (
            <ul className="ledger">
              <li>
                <h2 className="section-mark wide-mark">{fi.recentlyTrained}</h2>
                <ul className="ledger">{shownTrained.map(row)}</ul>
                {/* Capped so the alphabet still starts within a screen. */}
                {hiddenTrained > 0 && (
                  <button className="upcoming" onClick={() => setAllTrained(true)}>
                    <span className="t-data grow">{fi.moreTrained(hiddenTrained)}</span>
                    <span className="t-data">▾</span>
                  </button>
                )}
              </li>
            </ul>
          )}

          {rest.length > 0 && (
            <ul className="ledger">
              {trained.length > 0 && (
                <li>
                  <h2 className="section-mark wide-mark">{fi.otherMovements}</h2>
                </li>
              )}
              {byInitial(rest).map((group, gi) => (
                <li
                  key={group.letter}
                  style={{ animationDelay: `${Math.min(gi, 8) * 22}ms` }}
                >
                  <h2 className="section-mark">{group.letter}</h2>
                  <ul className="ledger">{group.items.map(row)}</ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}

function Entry({
  movement: m,
  stat,
  admin,
  onClick,
}: {
  movement: EffectiveMovement
  stat: MovementStat | null
  admin: boolean
  onClick: () => void
}) {
  // The English name is canonical-data business, so it only shows while editing.
  const detail = [
    m.primaryMuscles.map(muscleFi).join(' · '),
    equipmentFi(m.equipment),
    admin && m.nameFi ? m.nameEn : null,
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

      {/* Your training, or — while editing — the state of the record. An empty
          rail is the answer for a movement you have never done: absence reads as
          "not yet" without needing a badge for it. */}
      <span className="rail">
        {admin ? (
          <>
            {'custom' in m && <span className="flagtag own">{fi.ownMovement}</span>}
            {needsReview(m) && <span className="flagtag">{fi.incomplete}</span>}
            {m.edited.size > 0 && <span className="pip" title={fi.edited} />}
          </>
        ) : (
          stat && (
            <>
              <span className="t-data rail-count">{fi.timesDone(stat.sessions)}</span>
              {stat.best && <span className="t-data">{setsLine([stat.best])}</span>}
            </>
          )
        )}
      </span>
    </button>
  )
}
