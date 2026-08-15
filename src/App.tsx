import { useEffect, useState } from 'react'
import { ensureSeeded } from './db'
import { readOnboarded } from './lib/onboarding'
import { closeStaleSessions } from './lib/session'
import { Toaster, toast } from './lib/toast'
import { fi } from './i18n'
import { BulkRename } from './screens/BulkRename'
import { Library } from './screens/Library'
import { MovementEdit } from './screens/MovementEdit'
import { Overrides } from './screens/Overrides'
import { Settings } from './screens/Settings'
import { SessionScreen } from './screens/SessionScreen'
import { SessionSummary } from './screens/SessionSummary'
import { Day } from './screens/Day'
import { Onboarding } from './screens/Onboarding'
import { RoutinePicker } from './screens/RoutinePicker'
import { Today } from './screens/Today'

type View =
  | { name: 'today' }
  | { name: 'day'; at: number }
  /** `from` is where Back returns to — the picker is reachable from both. */
  | { name: 'pick'; at: number; from: 'today' | 'day' }
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
  /**
   * Decided once, at mount, and not re-read afterwards.
   *
   * A live query here was wrong in a way worth recording: onboarding writes its
   * completion flag when the name is submitted — so that killing the app on the
   * routine step does not raise the wall again — and a reactive gate saw that
   * write and unmounted the flow before its second step could render. Who is
   * being shown the app is not a question to re-answer mid-flow.
   */
  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ name: 'today' })

  useEffect(() => {
    ensureSeeded()
      // Sessions nobody came back to are closed at their last logged set.
      .then(closeStaleSessions)
      .then(readOnboarded)
      .then((done) => {
        setOnboarded(done)
        setReady(true)
      }, (err) => setError(String(err)))
  }, [])

  const today = () => setView({ name: 'today' })
  const library = () => setView({ name: 'library' })
  const inSession = view.name === 'session'

  return (
    <div className="app">
      {error ? (
        <p className="blank note">{error}</p>
      ) : !ready || onboarded === null ? (
        <p className="blank note">{fi.loading}</p>
      ) : !onboarded ? (
        /* Above the view switch and outside the dock: the gate is about the
           whole shell, and leaving the tabs live would let Liikekirjasto walk
           straight around it. After `ready`, because step 2 needs the seed. */
        <Onboarding
          onStarted={(id) => {
            setView(id ? { name: 'session', id } : { name: 'today' })
            setOnboarded(true)
          }}
        />
      ) : (
        <>
          {view.name === 'today' ? (
            <Today
              onOpenSession={(id) => setView({ name: 'session', id })}
              onOpenDay={(at) => setView({ name: 'day', at })}
              onPick={() => setView({ name: 'pick', at: Date.now(), from: 'today' })}
              onOpenSettings={() => setView({ name: 'settings' })}
            />
          ) : view.name === 'day' ? (
            <Day
              at={view.at}
              onBack={today}
              onAddWorkout={() => setView({ name: 'pick', at: view.at, from: 'day' })}
              onOpenSummary={(id) => setView({ name: 'summary', id })}
            />
          ) : view.name === 'pick' ? (
            <RoutinePicker
              at={view.at}
              onBack={() =>
                view.from === 'day' ? setView({ name: 'day', at: view.at }) : today()
              }
              onStarted={(id) => setView({ name: 'session', id })}
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

          {/* One dock so the action bar and the tabs stack instead of fighting
              over `bottom: 0`. Editing is deliberately unreachable while a
              session is live: a mis-tap mid-set would be costly. */}
          {!inSession && (
            <div className="dock">
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
            </div>
          )}
        </>
      )}
      <Toaster />
    </div>
  )
}
