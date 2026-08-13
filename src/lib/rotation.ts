import { db } from '../db'
import type { Template } from '../types'

export interface RotationEntry {
  template: Template
  /** When this routine was last completed, or null if never. */
  lastDoneAt: number | null
  isNext: boolean
}

export interface Rotation {
  group: string
  entries: RotationEntry[]
  next: Template
  /** 1-based position of `next` in the cycle, for "2/3". */
  position: number
  length: number
}

/**
 * What to train next, derived rather than scheduled.
 *
 * A routine group is an ordered cycle — Työntö → Veto → Jalat — and finished
 * sessions already record which routine they came from, so the next one falls
 * out of history with nothing extra stored. No calendar, which suits training
 * on the days you actually get to the gym rather than the days a plan assigned.
 *
 * Routines the user saved themselves have no group and form no cycle, so they
 * are left out.
 */
export async function rotations(): Promise<Rotation[]> {
  const [templates, sessions] = await Promise.all([
    db.templates.toArray(),
    db.sessions.toArray(),
  ])

  const finished = sessions
    .filter((s) => s.finishedAt !== null && s.templateId !== null)
    .sort((a, b) => b.startedAt - a.startedAt)

  /** Most recent completion per routine. */
  const lastDone = new Map<string, number>()
  for (const s of finished) {
    if (!lastDone.has(s.templateId!)) lastDone.set(s.templateId!, s.startedAt)
  }

  const byGroup = new Map<string, Template[]>()
  for (const t of templates) {
    if (!t.group) continue
    byGroup.set(t.group, [...(byGroup.get(t.group) ?? []), t])
  }

  const out: Rotation[] = []
  for (const [group, members] of byGroup) {
    const cycle = [...members].sort((a, b) => a.order - b.order)

    // The cycle advances from whichever of its routines was completed last.
    const lastInGroup = finished.find((s) =>
      cycle.some((t) => t.id === s.templateId),
    )
    const lastIndex = lastInGroup
      ? cycle.findIndex((t) => t.id === lastInGroup.templateId)
      : -1
    const nextIndex = lastIndex === -1 ? 0 : (lastIndex + 1) % cycle.length

    out.push({
      group,
      entries: cycle.map((template, i) => ({
        template,
        lastDoneAt: lastDone.get(template.id) ?? null,
        isNext: i === nextIndex,
      })),
      next: cycle[nextIndex],
      position: nextIndex + 1,
      length: cycle.length,
    })
  }
  return out
}

/**
 * The cycle the user is actually part-way through: the group of the most recent
 * completed session. Null before any templated session has been finished — with
 * no history there is no "next", and guessing one would be inventing a plan.
 */
export async function currentRotation(): Promise<Rotation | null> {
  const all = await rotations()
  if (!all.length) return null

  const sessions = await db.sessions.toArray()
  const last = sessions
    .filter((s) => s.finishedAt !== null && s.templateId !== null)
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  if (!last) return null

  return (
    all.find((r) => r.entries.some((e) => e.template.id === last.templateId)) ?? null
  )
}
