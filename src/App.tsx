import { useEffect, useState } from 'react'
import { ensureSeeded } from './db'
import { fi } from './i18n'
import { BulkRename } from './screens/BulkRename'
import { Library } from './screens/Library'
import { MovementEdit } from './screens/MovementEdit'
import { Overrides } from './screens/Overrides'

type View =
  | { name: 'library' }
  | { name: 'edit'; id: string }
  | { name: 'rename' }
  | { name: 'overrides' }

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
        <p className="blank note">{error}</p>
      ) : !ready ? (
        <p className="blank note">{fi.loading}</p>
      ) : view.name === 'library' ? (
        <Library
          onEdit={(id) => setView({ name: 'edit', id })}
          onBulkRename={() => setView({ name: 'rename' })}
          onOverrides={() => setView({ name: 'overrides' })}
        />
      ) : view.name === 'edit' ? (
        <MovementEdit id={view.id} onBack={library} />
      ) : view.name === 'rename' ? (
        <BulkRename onBack={library} />
      ) : (
        <Overrides onBack={library} />
      )}
    </div>
  )
}
