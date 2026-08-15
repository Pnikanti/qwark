import { db } from '../db'
import { readProfile } from './settings'

const KEY = 'onboarding'

interface OnboardingState {
  completedAt: number
  /** Room to ask something new later without a schema change. Unused so far. */
  version: number
}

/**
 * Whether the first-run flow is behind us.
 *
 * Recorded as its own flag rather than inferred from `profile.name`, because
 * inference would re-raise the whole wall the moment someone cleared their name
 * in Asetukset — two unrelated facts tied together.
 *
 * The backfill is the part that matters: anyone already training in this app
 * must not be stopped by a build that adds onboarding. Sessions or a name are
 * proof enough that they are past it. A genuinely new install has neither, so
 * the gate still fires exactly once, for the people it is for.
 *
 * It lives here at read time rather than in a Dexie upgrade because it has to be
 * right on a fresh install too, where no upgrade ever runs.
 */
export async function readOnboarded(): Promise<boolean> {
  if (((await db.meta.get(KEY))?.value as OnboardingState | undefined)?.completedAt) return true

  const returning = (await db.sessions.count()) > 0 || (await readProfile()).name !== ''
  if (returning) {
    await completeOnboarding()
    return true
  }
  return false
}

export async function completeOnboarding(): Promise<void> {
  await db.meta.put({ key: KEY, value: { completedAt: Date.now(), version: 1 } })
}
