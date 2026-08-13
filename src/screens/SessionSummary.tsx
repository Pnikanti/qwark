import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BodyPlan } from '../components/BodyPlan'
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
        return (
          <section className="panel movement" key={`${m.movementId}-${i}`}>
            <div className="movement-head">
              <BodyPlan
                primary={movement?.primaryMuscles ?? []}
                secondary={movement?.secondaryMuscles ?? []}
                size={34}
              />
              <h2 className="t-name grow">
                {movement?.nameFi ?? movement?.nameEn ?? m.movementId}
              </h2>
              {records[m.movementId] && <span className="flagtag record">{fi.record}</span>}
            </div>
            <p className="prev t-data">{setsLine(m.sets)}</p>
            {oneRm !== null && (
              <p className="t-data">
                {fi.estimatedMax} ≈ {oneRm} kg
              </p>
            )}
            {m.note && <p className="note">{m.note}</p>}
          </section>
        )
      })}

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
