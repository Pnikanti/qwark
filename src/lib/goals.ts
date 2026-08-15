import type { Template } from '../types'

export type Goal = 'strength' | 'muscle' | 'habit'

export const GOALS: Goal[] = ['strength', 'muscle', 'habit']

/**
 * Which seeded group each goal points at.
 *
 * Anchored on template ids rather than group names: ids are opaque and pinned,
 * while group names are Finnish display strings a seed bump may reword. If an
 * anchor ever disappears the recommendation simply goes away.
 */
const GOAL_ANCHOR: Record<Goal, string> = {
  strength: 'viisi-viisi-a',
  muscle: 'tyontopaiva',
  habit: 'ylakroppa',
}

/**
 * The group to mark as recommended, or null.
 *
 * A recommendation, never a filter — every routine stays listed and startable.
 * Steering someone toward 5×5 is helpful; hiding the other five from them on the
 * strength of one tap in onboarding is not.
 */
export function recommendedGroup(goal: Goal | null, templates: Template[]): string | null {
  if (!goal) return null
  return templates.find((t) => t.id === GOAL_ANCHOR[goal])?.group ?? null
}
