import { useEffect, useRef, useState } from 'react'
import { fi } from '../i18n'
import { exportOverrides, importOverrides } from '../lib/movements'

/** Round-trips data/overrides.json, the same file scripts/build-movements.py reads. */
export function ExportOverrides({ onBack }: { onBack: () => void }) {
  const [json, setJson] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    exportOverrides().then(setJson)
  }, [])

  const count = json ? Object.keys(JSON.parse(json) as object).length : 0

  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'overrides.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (file: File) => {
    try {
      const result = await importOverrides(await file.text())
      setStatus(
        [
          fi.imported(result.applied),
          result.unknown.length ? fi.importUnknown(result.unknown) : null,
        ]
          .filter(Boolean)
          .join(' · '),
      )
      setJson(await exportOverrides())
    } catch (err) {
      setStatus(String(err))
    }
  }

  return (
    <>
      <div className="topbar">
        <button className="ghost small" onClick={onBack}>
          ← {fi.back}
        </button>
        <h1>{fi.export}</h1>
      </div>

      <div className="card">
        <p className="count">
          {count > 0 ? fi.overrideCount(count) : fi.noOverrides}
        </p>
        <p className="note">{fi.exportHint}</p>
        <div className="actions">
          <button className="primary" onClick={download} disabled={count === 0}>
            {fi.export} overrides.json
          </button>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(json)
              setStatus(fi.copied)
            }}
            disabled={count === 0}
          >
            {fi.copy}
          </button>
          <button onClick={() => fileInput.current?.click()}>{fi.import}</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onFile(file)
              e.target.value = ''
            }}
          />
        </div>
        {status && (
          <p className="note" style={{ marginTop: 'var(--s-3)' }}>
            {status}
          </p>
        )}
      </div>

      {count > 0 && (
        <div className="card">
          <textarea readOnly value={json} rows={16} spellCheck={false} />
        </div>
      )}
    </>
  )
}
