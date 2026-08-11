import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { fi } from '../i18n'
import { listMovements, patchMovement } from '../lib/movements'

/**
 * The efficient path for a translation pass: one tabbable list, no navigation
 * between movements. Saves on blur so tabbing straight through works.
 */
export function BulkTranslate({ onBack }: { onBack: () => void }) {
  const movements = useLiveQuery(listMovements, [])
  const [untranslatedOnly, setUntranslatedOnly] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const rows = useMemo(() => {
    if (!movements) return []
    return movements
      .filter((m) => !m.hidden)
      .filter((m) => (untranslatedOnly ? !m.nameFi : true))
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en'))
  }, [movements, untranslatedOnly])

  const total = movements?.filter((m) => !m.hidden).length ?? 0
  const done = movements?.filter((m) => !m.hidden && m.nameFi).length ?? 0

  const commit = (id: string, seeded: string | null) => {
    const draft = drafts[id]
    if (draft === undefined) return
    const next = draft.trim() || null
    if (next !== seeded) patchMovement(id, { nameFi: next })
    setDrafts(({ [id]: _drop, ...rest }) => rest)
  }

  if (!movements) return <p className="note">{fi.loading}</p>

  return (
    <>
      <div className="topbar">
        <button className="ghost small" onClick={onBack}>
          ← {fi.back}
        </button>
        <h1>{fi.bulkTranslate}</h1>
      </div>

      <div className="chips">
        <button
          className="chip"
          aria-pressed={untranslatedOnly}
          onClick={() => setUntranslatedOnly((v) => !v)}
        >
          {fi.untranslatedOnly}
        </button>
      </div>

      <div className="bulk">
        {rows.map((m) => (
          <div className="bulk-row" key={m.id}>
            <span className="en" title={m.nameEn}>
              {m.nameEn}
            </span>
            <input
              value={drafts[m.id] ?? m.nameFi ?? ''}
              placeholder={fi.nameFi}
              onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
              onBlur={() => commit(m.id, m.nameFi)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
          </div>
        ))}
      </div>

      <div className="progress">
        <span className="count">{fi.translated(done, total)}</span>
        <button className="primary small" style={{ marginLeft: 'auto' }} onClick={onBack}>
          {fi.done}
        </button>
      </div>
    </>
  )
}
