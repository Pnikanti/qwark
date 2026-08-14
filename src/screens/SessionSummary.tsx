import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BodyPlan } from '../components/BodyPlan'
import { MovementHistory } from '../components/MovementHistory'
import { fi } from '../i18n'
import { durationOrDash, setsLine, shortDate } from '../lib/format'
import { listMovements } from '../lib/movements'
import { toast } from '../lib/toast'
import {
  bestWorkingSet,
  completedSetCount,
  estimatedOneRepMax,
  getSession,
  previousBestKg,
  saveAsTemplate,
  volumeKg,
} from '../lib/session'

export function SessionSummary({ id, onDone }: { id: string; onDone: () => void }) {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  /** Movement id whose history is open, as a sheet over the summary. */
  const [historyOf, setHistoryOf] = useState<string | null>(null)

  const data = useLiveQuery(async () => {
    const session = await getSession(id)
    if (!session) return null
    const records: Record<string, boolean> = {}
    for (const m of session.movements) {
      const best = bestWorkingSet(m)
      if (!best?.kg) continue
      records[m.movementId] = best.kg > (await previousBestKg(m.movementId, session.id))
    }
    return { session, records, movements: await listMovements() }
  }, [id])

  if (!data) return <p className="blank note">{fi.loading}</p>
  const { session, records } = data
  const byId = new Map(data.movements.map((m) => [m.id, m]))

  return (
    <>
      <header className="masthead">
        <h1 className="t-title">{fi.summary}</h1>
        <span className="t-data">
          {session.templateName ?? fi.startEmpty} · {shortDate(session.startedAt)}
        </span>
      </header>

      <div className="panel figures">
        <Figure
          label={fi.duration}
          value={durationOrDash((session.finishedAt ?? Date.now()) - session.startedAt)}
        />
        <Figure label={fi.completedSets} value={String(completedSetCount(session))} />
        <Figure label={fi.volume} value={`${volumeKg(session).toLocaleString('fi')} kg`} />
      </div>

      {session.movements.map((m, i) => {
        const movement = byId.get(m.movementId)
        const best = bestWorkingSet(m)
        const oneRm = best?.kg && best?.reps ? estimatedOneRepMax(best.kg, best.reps) : null
        const label = movement?.nameFi ?? movement?.nameEn ?? m.movementId
        return (
          <section className="panel movement" key={`${m.movementId}-${i}`}>
            {/* The row is the control, not just the name: a summary is read on a
                phone, and one line of text is a poor target. The heading level is
                given up for that — this screen keeps its h1, and a movement here
                is something you act on rather than a section you navigate to. */}
            <button
              className="movement-head"
              onClick={() => setHistoryOf(m.movementId)}
              aria-label={`${label} — ${fi.history}`}
            >
              <BodyPlan
                primary={movement?.primaryMuscles ?? []}
                secondary={movement?.secondaryMuscles ?? []}
                size={34}
              />
              <span className="t-name grow">{label}</span>
              {records[m.movementId] && <span className="flagtag record">{fi.record}</span>}
              <span className="t-data go" aria-hidden="true">
                ▸
              </span>
            </button>
            <p className="setline t-data">{setsLine(m.sets)}</p>
            {oneRm !== null && (
              <p className="t-data">
                {fi.estimatedMax} ≈ {oneRm} kg
              </p>
            )}
            {m.note && <p className="note">{m.note}</p>}
          </section>
        )
      })}

      {historyOf && (
        <MovementHistory
          movementId={historyOf}
          name={byId.get(historyOf)?.nameFi ?? byId.get(historyOf)?.nameEn ?? historyOf}
          onClose={() => setHistoryOf(null)}
        />
      )}

      {/* Ad hoc sessions can become a routine — the template grows out of what
          was actually done rather than being planned up front. */}
      {session.templateId === null && !saved && (
        <div className="panel">
          <div className="field">
            <div className="field-label">
              <span className="t-data">{fi.saveAsTemplate}</span>
            </div>
            <input
              value={name}
              placeholder={fi.templateName}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="row-actions">
            <button
              className="btn"
              disabled={!name.trim()}
              onClick={async () => {
                await saveAsTemplate(id, name)
                toast(fi.templateSaved(name.trim()))
                setSaved(true)
              }}
            >
              {fi.save}
            </button>
          </div>
        </div>
      )}

      <div className="footbar">
        <span className="t-data">
          {volumeKg(session).toLocaleString('fi')} kg ·{' '}
          {fi.setCount(completedSetCount(session))}
        </span>
        <button className="btn solid" style={{ marginLeft: 'auto' }} onClick={onDone}>
          {fi.done}
        </button>
      </div>
    </>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="figure">
      <span className="figure-value">{value}</span>
      <span className="t-data">{label}</span>
    </div>
  )
}
