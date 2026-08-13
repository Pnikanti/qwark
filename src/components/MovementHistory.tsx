import { useLiveQuery } from 'dexie-react-hooks'
import { fi } from '../i18n'
import { fullDate, kgLabel, relativeAge, setsLine } from '../lib/format'
import { movementHistory, type HistoryEntry } from '../lib/session'
import type { LoggedSet } from '../types'

/**
 * Everything ever logged for one movement.
 *
 * This exists because the session view's one-line `Viime kerralla` was the only
 * place history surfaced at all — a summary of the last session, standing in for
 * a record it could not show. A summary is the wrong shape for "am I getting
 * stronger", which is the question you actually open history to answer.
 *
 * A sheet rather than a screen: it is opened mid-set, and pushing a route would
 * throw away which movement the accordion has open — including a movement you
 * deliberately parked on to add extra sets.
 */
export function MovementHistory({
  movementId,
  name,
  onClose,
}: {
  movementId: string
  name: string
  onClose: () => void
}) {
  const entries = useLiveQuery(() => movementHistory(movementId), [movementId])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        /* Full height only when there is a list to scroll — an empty state in
           an 88vh sheet is mostly blank. */
        className={`sheet${entries?.length ? ' tall' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${name} — ${fi.history}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <span className="t-data">{fi.history}</span>
          <button className="revert" onClick={onClose}>
            {fi.close}
          </button>
        </div>

        <h2 className="hist-name t-name">{name}</h2>

        {!entries ? (
          <p className="blank note">{fi.loading}</p>
        ) : entries.length === 0 ? (
          <div className="blank">
            <p className="note">{fi.noMovementHistory}</p>
            <p className="note">{fi.noMovementHistoryHint}</p>
          </div>
        ) : (
          <>
            <Summary entries={entries} />
            <Trend entries={entries} />
            <ul className="ledger scroller">
              {entries.map((entry) => (
                <Entry key={entry.sessionId} entry={entry} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

/** How much, how heavy, how recently — the three questions, answered once. */
function Summary({ entries }: { entries: HistoryEntry[] }) {
  const best = entries.reduce<LoggedSet | null>((top, e) => {
    if (!e.topSet) return top
    if (!top) return e.topSet
    return (e.topSet.kg ?? 0) > (top.kg ?? 0) ? e.topSet : top
  }, null)

  return (
    <dl className="hist-summary">
      <div>
        <dt className="t-data">{fi.sessionsLabel}</dt>
        <dd>{entries.length}</dd>
      </div>
      {best && (
        <div>
          <dt className="t-data">{fi.record}</dt>
          <dd>{setsLine([best])}</dd>
        </div>
      )}
      <div>
        <dt className="t-data">{fi.previous}</dt>
        <dd>{relativeAge(entries[0].at)}</dd>
      </div>
    </dl>
  )
}

/**
 * Heaviest working set per session, oldest to newest.
 *
 * Deliberately not zero-based: loads cluster in a narrow band near the top of
 * their range, so a zero baseline renders every session as the same bar. The
 * range is printed underneath instead, which is what makes a cropped scale
 * honest rather than flattering.
 */
function Trend({ entries }: { entries: HistoryEntry[] }) {
  const points = entries
    .filter((e) => e.topSet?.kg != null && e.topSet.kg > 0)
    .slice(0, 16)
    .reverse()
    .map((e) => ({ at: e.at, kg: e.topSet!.kg! }))

  // Two sessions is a pair of numbers, not a trend; the ledger below says it
  // better than a chart with two bars would.
  if (points.length < 3) return null

  const loads = points.map((p) => p.kg)
  const min = Math.min(...loads)
  const max = Math.max(...loads)

  return (
    <section className="trend-block">
      <p className="t-data trend-label">{fi.trend}</p>
      <div
        className="trend"
        role="img"
        aria-label={`${fi.trend}: ${loads.map((kg) => `${kgLabel(kg)} kg`).join(', ')}`}
      >
        {points.map((p, i) => (
          <span
            key={p.at}
            className={`trend-bar${i === points.length - 1 ? ' now' : ''}`}
            style={{ height: `${max === min ? 100 : 22 + 78 * ((p.kg - min) / (max - min))}%` }}
            title={`${fullDate(p.at)} · ${kgLabel(p.kg)} kg`}
          />
        ))}
      </div>
      <p className="t-data trend-scale">
        <span>{kgLabel(min)} kg</span>
        <span>{kgLabel(max)} kg</span>
      </p>
    </section>
  )
}

function Entry({ entry }: { entry: HistoryEntry }) {
  return (
    <li className="hist">
      <div className="hist-head">
        <span className="t-data grow">
          {fullDate(entry.at)}
          {entry.retro && ` · ${fi.retroLogged}`}
        </span>
        {entry.templateName && <span className="t-data">{entry.templateName}</span>}
      </div>

      {entry.working.length > 0 && (
        <span className="logline">
          <span className="logline-tag t-data">{fi.workingLabel}</span>
          {setsLine(entry.working)}
        </span>
      )}
      {entry.warmups.length > 0 && (
        <span className="logline">
          <span className="logline-tag t-data">{fi.warmupsLabel}</span>
          {setsLine(entry.warmups)}
        </span>
      )}

      {entry.volumeKg > 0 && (
        <span className="logline">
          <span className="logline-tag t-data">{fi.volume}</span>
          {entry.volumeKg.toLocaleString('fi')} kg
        </span>
      )}
      {entry.note && <p className="hist-note">{entry.note}</p>}
    </li>
  )
}
