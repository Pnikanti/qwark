import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BodyPlan } from '../components/BodyPlan'
import { Dialogue } from '../components/Dialogue'
import { MovementHistory } from '../components/MovementHistory'
import { fi } from '../i18n'
import { durationOrDash, setsLine, shortDate } from '../lib/format'
import { buildDialogueContext, clearAnswer, saveAnswer } from '../lib/feedback'
import { listMovements } from '../lib/movements'
import { useGym } from '../lib/settings'
import { toast } from '../lib/toast'
import {
  bestWorkingSet,
  workingSetCount,
  estimatedOneRepMax,
  getSession,
  previousBestKg,
  saveAsTemplate,
  volumeKg,
} from '../lib/session'

export function SessionSummary({
  id,
  justFinished = false,
  onDone,
}: {
  id: string
  /**
   * True only when arriving straight from finishing. Reaching the same summary
   * from Päivä must never raise the review sheet unprompted — the question has
   * usually been settled by later training.
   */
  justFinished?: boolean
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  /** Movement id whose history is open, as a sheet over the summary. */
  const [historyOf, setHistoryOf] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const gym = useGym()

  // The dialogue's own trigger: no events means nothing to say, and the sheet
  // never appears. Kept live so answering re-derives the stated loads.
  const review = useLiveQuery(() => buildDialogueContext(id, gym), [id, gym])

  // A beat before it rises, so the figures just earned are readable first.
  useEffect(() => {
    if (!justFinished || !review?.events.length) return
    const t = setTimeout(() => setReviewOpen(true), 500)
    return () => clearTimeout(t)
  }, [justFinished, review?.events.length])

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
        <Figure label={fi.completedSets} value={String(workingSetCount(session))} />
        <Figure label={fi.volume} value={`${volumeKg(session).toLocaleString('fi')} kg`} />
      </div>

      {session.movements.map((m, i) => {
        const movement = byId.get(m.movementId)
        const best = bestWorkingSet(m)
        const oneRm = best?.kg && best?.reps ? estimatedOneRepMax(best.kg, best.reps) : null
        const label = movement?.nameFi ?? movement?.nameEn ?? m.movementId
        const warmups = m.sets.filter((s) => s.kind === 'warmup')
        const working = m.sets.filter((s) => s.kind === 'working')
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
            {/* Warmups on their own line, never mixed into the work. They are
                excluded from the volume and the set count above, so folding them
                into one undifferentiated line here would make the numbers look
                wrong rather than make the session look bigger. */}
            {warmups.length > 0 && (
              <p className="setline t-data">
                <span className="logline-tag t-data">{fi.warmupsLabel}</span>
                {setsLine(warmups)}
              </p>
            )}
            {working.length > 0 && <p className="setline t-data">{setsLine(working)}</p>}
            {oneRm !== null && (
              <p className="t-data">
                {fi.estimatedMax} ≈ {oneRm} kg
              </p>
            )}
            {m.note && <p className="note">{m.note}</p>}
          </section>
        )
      })}

      {/* The permanent way in, whether or not the sheet rose — so dismissing
          it never destroys the content. Absent when there is nothing to say,
          and because every block carries its own rule, its absence leaves no
          gap to compensate for. */}
      {review !== undefined && review.events.length > 0 && (
        <button className="entry" onClick={() => setReviewOpen(true)}>
          <span className="grow">
            <span className="t-data">{fi.nextTimeSheet}</span>
            <span className="t-name">{fi.openNextTime}</span>
          </span>
          <span className="t-data">▸</span>
        </button>
      )}

      {reviewOpen && review && (
        <Dialogue
          ctx={review}
          nameOf={(mid) => byId.get(mid)?.nameFi ?? byId.get(mid)?.nameEn ?? mid}
          onAnswer={(mid, cause) => saveAnswer(id, mid, cause)}
          onClear={(mid) => clearAnswer(id, mid)}
          onClose={() => setReviewOpen(false)}
        />
      )}

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
          {fi.setCount(workingSetCount(session))}
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
