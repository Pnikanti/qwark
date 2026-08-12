import { useEffect, useState } from 'react'
import { ensureSeeded } from './db'
import { Toaster, toast } from './lib/toast'
import { fi } from './i18n'
import { BulkRename } from './screens/BulkRename'
import { Library } from './screens/Library'
import { MovementEdit } from './screens/MovementEdit'
import { Overrides } from './screens/Overrides'
import { Settings } from './screens/Settings'
import { SessionScreen } from './screens/SessionScreen'
import { SessionSummary } from './screens/SessionSummary'
import { Today } from './screens/Today'

type View =
  | { name: 'today' }
  | { name: 'session'; id: string }
  | { name: 'summary'; id: string }
  | { name: 'library' }
  | { name: 'edit'; id: string }
  | { name: 'rename' }
  | { name: 'overrides' }
  | { name: 'settings' }

/** Tänään and the library are the two roots; everything else is pushed on top. */
const ROOTS = ['today', 'library'] as const

export function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ name: 'today' })

  useEffect(() => {
    ensureSeeded().then(
      () => setReady(true),
      (err) => setError(String(err)),
    )
  }, [])

  const today = () => setView({ name: 'today' })
  const library = () => setView({ name: 'library' })
  const inSession = view.name === 'session'

  return (
    <div className="app">
      {error ? (
        <p className="blank note">{error}</p>
      ) : !ready ? (
        <p className="blank note">{fi.loading}</p>
      ) : (
        <>
          {view.name === 'today' ? (
            <Today
              onOpenSession={(id) => setView({ name: 'session', id })}
              onOpenLibrary={library}
              onOpenSettings={() => setView({ name: 'settings' })}
              onOpenSummary={(id) => setView({ name: 'summary', id })}
            />
          ) : view.name === 'session' ? (
            <SessionScreen
              id={view.id}
              onFinished={(id) => setView({ name: 'summary', id })}
              onDiscarded={() => {
                toast(fi.discarded, { tone: 'warn' })
                today()
              }}
            />
          ) : view.name === 'summary' ? (
            <SessionSummary id={view.id} onDone={today} />
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
          ) : view.name === 'settings' ? (
            <Settings onBack={today} />
          ) : (
            <Overrides onBack={library} />
          )}

          {/* Editing is deliberately unreachable while a session is live: a
              mis-tap mid-set would be costly. */}
          {!inSession && (
            <nav className="tabs">
              {ROOTS.map((root) => (
                <button
                  key={root}
                  className="tab"
                  aria-current={view.name === root ? 'page' : undefined}
                  onClick={() => (root === 'today' ? today() : library())}
                >
                  {root === 'today' ? fi.today : fi.library}
                </button>
              ))}
            </nav>
          )}
        </>
      )}
      <Toaster />
    </div>
  )
}
