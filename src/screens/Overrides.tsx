import { useEffect, useRef, useState } from 'react'
import { fi } from '../i18n'
import { exportOverrides, importOverrides } from '../lib/movements'

/** Round-trips data/overrides.json — the file scripts/build-movements.py reads. */
export function Overrides({ onBack }: { onBack: () => void }) {
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

  const receive = async (file: File) => {
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
      <header className="masthead">
        <button className="back" onClick={onBack}>
          ← {fi.back}
        </button>
        <h1 className="t-title">{fi.overrides}</h1>
        <span className="t-data">{fi.editedCount(count)}</span>
      </header>

      <div className="panel">
        <p className="note">{fi.exportHint}</p>
        <div className="row-actions">
          <button className="btn solid btn-tall" onClick={download} disabled={!count}>
            {fi.exportFile}
          </button>
          <button
            className="btn btn-tall"
            disabled={!count}
            onClick={async () => {
              await navigator.clipboard.writeText(json)
              setStatus(fi.copied)
            }}
          >
            {fi.copyJson}
          </button>
          <button className="btn btn-tall" onClick={() => fileInput.current?.click()}>
            {fi.importFile}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) receive(file)
              e.target.value = ''
            }}
          />
        </div>
        {status && (
          <p className="note" style={{ marginTop: 12 }}>
            {status}
          </p>
        )}
      </div>

      {count > 0 ? (
        <div className="panel">
          <textarea readOnly value={json} spellCheck={false} aria-label={fi.overrides} />
        </div>
      ) : (
        <div className="blank">
          <span className="t-data">{fi.noOverrides}</span>
          <p className="note">{fi.noOverridesHint}</p>
        </div>
      )}
    </>
  )
}
