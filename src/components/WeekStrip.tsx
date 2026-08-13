import { BodyPlan } from './BodyPlan'
import { fi, muscleFi } from '../i18n'
import type { Week } from '../lib/week'

/**
 * The week you have actually had: which days you trained, the totals, and how
 * the work landed across muscle groups.
 *
 * Retrospective on purpose. A weekday plan would be mostly empty cells for
 * anyone training on the days they reach the gym, and a grid of missed days is
 * the shame mechanic SPEC.md rules out. This shows what happened, which is
 * something you can act on without being scolded.
 */
export function WeekStrip({
  week,
  onOpenDay,
}: {
  week: Week
  onOpenDay: (at: number) => void
}) {
  const busiest = Object.entries(week.setsPerMuscle)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <section className="week">
      <div className="week-head">
        <h2 className="t-title week-title">{fi.weekNumber(week.number)}</h2>
        <span className="t-data">
          {week.sessionCount === 0
            ? fi.noTrainingThisWeek
            : `${fi.sessionCount(week.sessionCount)} · ${fi.setCount(week.setCount)}${
                week.volume > 0 ? ` · ${week.volume.toLocaleString('fi')} kg` : ''
              }`}
        </span>
      </div>

      <ol className="week-days">
        {week.days.map((day) => {
          const trained = day.sessions.length > 0
          const label = day.sessions
            .map((s) => s.templateName ?? fi.startEmpty)
            .join(', ')
          const classes = [
            'week-day',
            trained ? 'trained' : '',
            day.isToday ? 'today' : '',
            day.isFuture ? 'future' : '',
          ]
            .filter(Boolean)
            .join(' ')

          // Every past or present day opens; only the future has nothing to show.
          return (
            <li key={day.at}>
              {day.isFuture ? (
                <div className={classes} aria-label={day.weekday}>
                  <span className="week-weekday t-data">{day.weekday}</span>
                  <span className="week-dot empty" aria-hidden="true" />
                  <span className="week-label t-data" />
                </div>
              ) : (
                <button
                  className={classes}
                  onClick={() => onOpenDay(day.at)}
                  title={label || day.weekday}
                >
                  <span className="week-weekday t-data">{day.weekday}</span>
                  <span
                    className={`week-dot${trained ? '' : ' empty'}`}
                    aria-hidden="true"
                  />
                  <span className="week-label t-data">{label}</span>
                </button>
              )}
            </li>
          )
        })}
      </ol>

      {week.workedMuscles.length > 0 && (
        <div className="week-balance">
          <BodyPlan
            primary={week.workedMuscles}
            view="both"
            size={96}
            intensity={week.muscleLoad}
            title={fi.muscleBalance}
          />
          <div className="week-balance-list">
            <span className="t-data">{fi.muscleBalance}</span>
            {busiest.map(([muscle, sets]) => (
              <span className="t-data week-muscle" key={muscle}>
                {muscleFi(muscle)}
                <span className="week-muscle-sets">
                  {fi.setCount(Math.round(sets))}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
