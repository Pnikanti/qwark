import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { localDay } from './format'
import type { BodyMetric } from '../types'

/**
 * Bodyweight readings.
 *
 * Writes append rather than overwrite, because a weight is something that was
 * true on a day and not a preference — the whole reason this is a table. Within
 * one day it does replace, so correcting a number you just typed does not leave
 * two readings hours apart pretending to be a trend.
 */
export async function logBodyweight(kg: number, at = Date.now()): Promise<void> {
  if (!(kg > 0)) return
  await db.bodyMetrics.put({ day: localDay(at), at, kg })
}

export async function latestBodyweight(): Promise<BodyMetric | null> {
  return (await db.bodyMetrics.orderBy('at').last()) ?? null
}

/** Null until the read resolves, so callers can tell "loading" from "never weighed". */
export function useBodyweight(): BodyMetric | null {
  return useLiveQuery(latestBodyweight, [], null)
}
