import { useEffect, useState } from 'react'
import { ensureSeeded } from './db'
import { fi } from './i18n'
import { BulkTranslate } from './screens/BulkTranslate'
import { ExportOverrides } from './screens/ExportOverrides'
import { Library } from './screens/Library'
import { MovementEdit } from './screens/MovementEdit'

type View =
  | { name: 'library' }
  | { name: 'edit'; id: string }
  | { name: 'bulk' }
  | { name: 'export' }

export function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ name: 'library' })

  useEffect(() => {
    ensureSeeded().then(
      () => setReady(true),
      (err) => setError(String(err)),
    )
  }, [])

  const library = () => setView({ name: 'library' })

  return (
    <div className="app">
      {error ? (
        <p className="note">{error}</p>
      ) : !ready ? (
        <p className="note">{fi.loading}</p>
      ) : view.name === 'library' ? (
        <Library
          onEdit={(id) => setView({ name: 'edit', id })}
          onBulkTranslate={() => setView({ name: 'bulk' })}
          onExport={() => setView({ name: 'export' })}
        />
      ) : view.name === 'edit' ? (
        <MovementEdit id={view.id} onBack={library} />
      ) : view.name === 'bulk' ? (
        <BulkTranslate onBack={library} />
      ) : (
        <ExportOverrides onBack={library} />
      )}
    </div>
  )
}
