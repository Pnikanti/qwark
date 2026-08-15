import { BodyPlan } from './BodyPlan'
import { fi } from '../i18n'
import { shortDate } from '../lib/format'
import type { EffectiveMovement, Template } from '../types'

export interface RoutineMeta {
  lastDoneAt: number | null
  isNext: boolean
}

/**
 * Routine groups, in cycle order. Lives here rather than on the landing screen:
 * seven rows came to 732px — 47% of the page — mostly repeating what the
 * Seuraava card already says.
 */
export function RoutineList({
  templates,
  movements,
  meta,
  onStart,
  startLabel,
  markLabel = fi.nextInCycle,
}: {
  templates: Template[]
  movements: Map<string, EffectiveMovement>
  meta: (templateId: string) => RoutineMeta
  onStart: (template: Template) => void
  /** "Aloita" today, "Lisää" for a day already past. */
  startLabel: string
  /** What `isNext` is marked as — the cycle position, or a goal's suggestion. */
  markLabel?: string
}) {
  const name = (id: string) =>
    movements.get(id)?.nameFi ?? movements.get(id)?.nameEn ?? id

  const groups = new Map<string, Template[]>()
  for (const t of [...templates].sort((a, b) => a.order - b.order)) {
    const key = t.group ?? fi.yourRoutines
    groups.set(key, [...(groups.get(key) ?? []), t])
  }

  return (
    <>
      {[...groups].map(([group, members]) => (
        <section key={group}>
          <h2 className="section-mark">{group}</h2>
          <ul className="ledger">
            {members.map((t) => (
              <li key={t.id}>
                <RoutineRow
                  template={t}
                  movements={movements}
                  label={t.items.map((i) => name(i.movementId)).join(' · ')}
                  meta={meta(t.id)}
                  markLabel={markLabel}
                  startLabel={startLabel}
                  onStart={() => onStart(t)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

function RoutineRow({
  template,
  movements,
  label,
  meta,
  markLabel,
  startLabel,
  onStart,
}: {
  template: Template
  movements: Map<string, EffectiveMovement>
  label: string
  meta: RoutineMeta
  markLabel: string
  startLabel: string
  onStart: () => void
}) {
  const primary = template.items.flatMap(
    (i) => movements.get(i.movementId)?.primaryMuscles ?? [],
  )
  const secondary = template.items.flatMap(
    (i) => movements.get(i.movementId)?.secondaryMuscles ?? [],
  )
  const totalSets = template.items.reduce((n, i) => n + i.sets, 0)

  return (
    <div className={`entry routine${meta.isNext ? ' is-next' : ''}`}>
      <BodyPlan primary={primary} secondary={secondary} size={42} view="both" />
      <span className="grow">
        <span className="t-name">
          {template.name}
          {meta.isNext && <span className="cycle-mark"> {markLabel}</span>}
        </span>
        <span className="t-data">
          {meta.lastDoneAt
            ? fi.lastDone(shortDate(meta.lastDoneAt))
            : `${template.items.length} ${fi.movementWord(template.items.length)} · ${fi.setCount(totalSets)}`}
        </span>
        <span className="t-data routine-detail">{label}</span>
      </span>
      <button className="btn" onClick={onStart}>
        {startLabel}
      </button>
    </div>
  )
}
