import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { fi } from '../i18n'
import { listMovements, patchMovement } from '../lib/movements'

/**
 * One tabbable list for a whole naming pass — no navigation between movements.
 * Commits on blur so tabbing straight through saves as you go.
 */
export function BulkRename({ onBack }: { onBack: () => void }) {
  const movements = useLiveQuery(listMovements, [])
  const [unnamedOnly, setUnnamedOnly] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const rows = useMemo(() => {
    if (!movements) return []
    return movements
      .filter((m) => !m.hidden)
      .filter((m) => (unnamedOnly ? !m.nameFi : true))
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en'))
  }, [movements, unnamedOnly])

  if (!movements) return <p className="blank note">{fi.loading}</p>

  const pool = movements.filter((m) => !m.hidden)
  const done = pool.filter((m) => m.nameFi).length

  const commit = (id: string, current: string | null) => {
    const draft = drafts[id]
    if (draft === undefined) return
    const next = draft.trim() || null
    if (next !== current) patchMovement(id, { nameFi: next })
    setDrafts(({ [id]: _drop, ...rest }) => rest)
  }

  return (
    <>
      <header className="masthead">
        <button className="back" onClick={onBack}>
          ← {fi.back}
        </button>
        <div className="masthead-top">
          <div className="grow">
            <h1 className="t-title">{fi.bulkRename}</h1>
            <span className="t-data">{fi.renameProgress(done, pool.length)}</span>
          </div>
          <button
            className="toggle"
            aria-pressed={unnamedOnly}
            onClick={() => setUnnamedOnly((v) => !v)}
          >
            {fi.untranslatedOnly}
          </button>
        </div>
      </header>

      <ul className="pairs">
        {rows.map((m) => (
          <li className="pair" key={m.id}>
            <span className="source" title={m.nameEn}>
              {m.nameEn}
            </span>
            <input
              value={drafts[m.id] ?? m.nameFi ?? ''}
              placeholder={fi.nameFi}
              aria-label={`${fi.nameFi}: ${m.nameEn}`}
              onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
              onBlur={() => commit(m.id, m.nameFi)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
          </li>
        ))}
      </ul>

      <div className="footbar">
        <span className="t-data">{fi.renameProgress(done, pool.length)}</span>
        <span className="meter">
          <span style={{ width: `${pool.length ? (done / pool.length) * 100 : 0}%` }} />
        </span>
        <button className="btn solid" onClick={onBack}>
          {fi.done}
        </button>
      </div>
    </>
  )
}
