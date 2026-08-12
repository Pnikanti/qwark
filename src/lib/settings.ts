import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { GymSettings } from '../types'

/** Olympic bar and a full set of IWF discs — the common case, not an assumption. */
export const DEFAULT_GYM: GymSettings = {
  barKg: 20,
  discs: [25, 20, 15, 10, 5, 2.5, 1.25],
}

/** Every disc size worth offering as a checkbox, including micro plates. */
export const KNOWN_DISCS = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5] as const

const KEY = 'gym'

export async function readGym(): Promise<GymSettings> {
  const stored = (await db.meta.get(KEY))?.value as GymSettings | undefined
  if (!stored) return DEFAULT_GYM
  const discs = [...stored.discs].sort((a, b) => b - a)
  return {
    barKg: stored.barKg > 0 ? stored.barKg : DEFAULT_GYM.barKg,
    // An empty disc set would make every load unreachable, so fall back.
    discs: discs.length ? discs : DEFAULT_GYM.discs,
  }
}

export async function writeGym(settings: GymSettings): Promise<void> {
  await db.meta.put({ key: KEY, value: settings })
}

/** Returns the defaults until the read resolves, so callers never see undefined. */
export function useGym(): GymSettings {
  return useLiveQuery(readGym, [], DEFAULT_GYM)
}
