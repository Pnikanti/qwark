import { useEffect, useRef, useState } from 'react'
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
            <Progress entries={entries} />
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

/**
 * The same overview, inline rather than in a sheet.
 *
 * The movement's page in the library used to keep this behind a `Historia →`
 * row, which put the name fields and the equipment dropdown above the thing you
 * actually came to see. What you have lifted outranks how the movement is
 * described, so it is on the page; the full session ledger stays one tap away.
 */
export function MovementOverview({
  movementId,
  onOpenAll,
}: {
  movementId: string
  onOpenAll: () => void
}) {
  const entries = useLiveQuery(() => movementHistory(movementId), [movementId])

  if (!entries) return <p className="panel note">{fi.loading}</p>

  if (entries.length === 0) {
    return (
      <div className="panel">
        <p className="note">{fi.noMovementHistory}</p>
        <p className="note">{fi.noMovementHistoryHint}</p>
      </div>
    )
  }

  return (
    <div className="panel">
      <Summary entries={entries} />
      <Progress entries={entries} />
      <button className="btn overview-all" onClick={onOpenAll}>
        {fi.allSessions(entries.length)}
      </button>
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
      {/* Epley, so sets at different rep counts are comparable. An estimate is
          labelled as one — it is not a lift you have made. */}
      {best?.kg != null && best.kg > 0 && best.reps != null && best.reps > 0 && (
        <div>
          <dt className="t-data">{fi.oneRepMax}</dt>
          <dd>{kgLabel(Math.round(best.kg * (1 + best.reps / 30) * 2) / 2)} kg</dd>
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
 * SVG in real pixels rather than a scaled viewBox: `preserveAspectRatio="none"`
 * would stretch the dots into ellipses and thin the strokes unevenly.
 */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Room for the y-axis labels, left of the plot. */
const GUTTER = 44
const LOAD_H = 118
const VOL_H = 32
const R_MAX = 6
/** How far the latest point's halo reaches beyond its dot. */
const HALO = 4
const MAX_SESSIONS = 30

const axisDate = (at: number) => {
  const d = new Date(at)
  return `${d.getDate()}.${d.getMonth() + 1}.`
}

/**
 * The overview: what you lifted, when, and how much of it.
 *
 * Two earlier versions were wrong in instructive ways. The first plotted one bar
 * per session, evenly spaced, for the top set alone — which hid the gaps between
 * sessions, and those are the difference between steady work and a month off. So
 * the axis became real time. The second drew a dot per *set*: on a 5×5 all five
 * share a load, so they landed on the same point and four of them were invisible.
 * Within-session spread is now a whisker, which draws itself only when the loads
 * actually differ, and the dot size carries the top set's reps.
 *
 * The load axis is deliberately not zero-based — loads cluster in a narrow band,
 * and a zero baseline flattens every session onto one row. Both ends of the
 * range are printed, which is what makes a cropped axis honest rather than
 * flattering. Volume *is* zero-based, because volume genuinely starts at zero;
 * a steady bar profile there is a true reading, not a rendering failure.
 */
function Progress({ entries }: { entries: HistoryEntry[] }) {
  const [ref, width] = useWidth()

  const capped = entries.length > MAX_SESSIONS
  // Bodyweight work has no load to plot, so the axis falls back to reps rather
  // than drawing a flat line at zero.
  const loaded = entries.some((e) => e.working.some((s) => (s.kg ?? 0) > 0))
  const valueOf = (s: LoggedSet) => (loaded ? (s.kg ?? 0) : (s.reps ?? 0))

  const points = entries
    .slice(0, MAX_SESSIONS)
    .reverse()
    .map((e) => {
      const sets = e.working.filter((s) => valueOf(s) > 0)
      const values = sets.map(valueOf)
      return {
        at: e.at,
        volume: e.volumeKg,
        sets,
        lo: Math.min(...values),
        hi: Math.max(...values),
        top: e.topSet && valueOf(e.topSet) > 0 ? e.topSet : sets[0],
      }
    })
    .filter((p) => p.sets.length > 0)

  // Two sessions is a pair of numbers; the ledger below states them better than
  // a chart with two dots would.
  if (points.length < 3) return null

  const values = points.flatMap((p) => p.sets.map(valueOf))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min

  // Scaled across the *plotted* rep range, not from zero. Anchoring at zero left
  // a 5-rep dot within 0.6px of an 8-rep one — a legend describing a difference
  // nobody can see.
  const topReps = points.map((p) => p.top.reps ?? 0)
  const repsLo = Math.min(...topReps)
  const repsHi = Math.max(...topReps)

  const t0 = points[0].at
  const t1 = points[points.length - 1].at
  // The right inset clears the halo, not just the dot — the newest point is
  // always the rightmost one, and its halo is 4px wider than its dot.
  const x0 = GUTTER + R_MAX
  const x1 = Math.max(x0 + 1, width - R_MAX - HALO)
  const x = (at: number) => (t1 === t0 ? (x0 + x1) / 2 : x0 + (x1 - x0) * ((at - t0) / (t1 - t0)))
  const y = (v: number) =>
    span === 0 ? LOAD_H / 2 : R_MAX + (LOAD_H - 2 * R_MAX) * (1 - (v - min) / span)

  // Area, not radius, carries the reps — a radius scale exaggerates by squaring.
  const R_LO = 3
  const varies = loaded && repsHi > repsLo
  const r = (set: LoggedSet) =>
    varies
      ? Math.sqrt(
          R_LO ** 2 +
            (R_MAX ** 2 - R_LO ** 2) * (((set.reps ?? 0) - repsLo) / (repsHi - repsLo)),
        )
      : 4

  const volMax = Math.max(...points.map((p) => p.volume), 1)
  const gap = points.length > 1 ? (x1 - x0) / (points.length - 1) : x1 - x0
  const barW = Math.max(3, Math.min(22, gap * 0.7))
  const hasVolume = points.some((p) => p.volume > 0)

  const unit = loaded ? ' kg' : ''

  return (
    <section className="chart-block">
      <p className="t-data chart-label">
        <span>{loaded ? fi.loadAxis : fi.reps}</span>
        {/* Explained only when there is a difference to explain. */}
        {varies && <span className="chart-hint">{fi.dotSizeIsReps}</span>}
      </p>

      <div className="chart" ref={ref}>
        <span className="chart-y top">
          {kgLabel(max)}
          {unit}
        </span>
        <span className="chart-y bottom">
          {kgLabel(min)}
          {unit}
        </span>
        {width > 0 && (
          <svg
            width={width}
            height={LOAD_H}
            role="img"
            aria-label={points
              .map((p) => `${axisDate(p.at)} ${kgLabel(valueOf(p.top))}${unit}`)
              .join(', ')}
          >
            {/* Spread within the session, drawn only when the loads differ — a
                straight 5×5 has nothing to show and gets nothing. */}
            {points
              .filter((p) => p.hi !== p.lo)
              .map((p) => (
                <line
                  key={p.at}
                  className="spread"
                  x1={x(p.at)}
                  x2={x(p.at)}
                  y1={y(p.hi)}
                  y2={y(p.lo)}
                />
              ))}
            <polyline
              className="topline"
              points={points.map((p) => `${x(p.at)},${y(valueOf(p.top))}`).join(' ')}
            />
            {/* The latest session gets a halo rather than a bigger dot — radius
                is spoken for by reps, and a ring in the ground colour is
                invisible on the ground. */}
            <circle
              className="halo"
              cx={x(points[points.length - 1].at)}
              cy={y(valueOf(points[points.length - 1].top))}
              r={r(points[points.length - 1].top) + HALO}
            />
            {points.map((p, i) => (
              <circle
                key={p.at}
                className={`peak${i === points.length - 1 ? ' now' : ''}`}
                cx={x(p.at)}
                cy={y(valueOf(p.top))}
                r={r(p.top)}
              />
            ))}
          </svg>
        )}
      </div>

      {hasVolume && (
        <>
          <p className="t-data chart-label">
            <span>{fi.volume}</span>
            {/* Marked as the axis top, or it reads as the latest session's. */}
            <span>
              {fi.axisMax} {volMax.toLocaleString('fi')} kg
            </span>
          </p>
          <div className="chart">
            {width > 0 && (
              <svg
                width={width}
                height={VOL_H}
                role="img"
                aria-label={points
                  .map((p) => `${axisDate(p.at)} ${p.volume.toLocaleString('fi')} kg`)
                  .join(', ')}
              >
                {points.map((p) => (
                  <rect
                    key={p.at}
                    className="volbar"
                    x={x(p.at) - barW / 2}
                    y={VOL_H - Math.max(1, (VOL_H - 2) * (p.volume / volMax))}
                    width={barW}
                    height={Math.max(1, (VOL_H - 2) * (p.volume / volMax))}
                  />
                ))}
              </svg>
            )}
          </div>
        </>
      )}

      <p className="t-data chart-dates">
        <span>{axisDate(t0)}</span>
        {capped && <span className="chart-hint">{fi.lastNSessions(MAX_SESSIONS)}</span>}
        <span>{axisDate(t1)}</span>
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
