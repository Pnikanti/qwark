import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

const KEY = 'notice'

/**
 * The early-stage notice, and how far it has been read.
 *
 * Bump when the text changes enough that someone who dismissed the old one
 * should be shown the new one. Nothing else keys off the number.
 */
export const NOTICE_VERSION = 1

interface NoticeState {
  dismissedVersion: number
  dismissedAt: number
}

/**
 * The notice version last acknowledged; 0 means never.
 *
 * Deliberately no backfill, unlike `readOnboarded` — someone who has been
 * logging in this app for weeks is exactly who the warning is for, so an
 * existing history must not count as having read it.
 */
export async function readNoticeSeen(): Promise<number> {
  const stored = (await db.meta.get(KEY))?.value as Partial<NoticeState> | undefined
  // Defaulted per field, like readAlerts: a state written before a field
  // existed has to read back as 0, not undefined.
  return stored?.dismissedVersion ?? 0
}

export async function dismissNotice(): Promise<void> {
  await db.meta.put({
    key: KEY,
    value: { dismissedVersion: NOTICE_VERSION, dismissedAt: Date.now() } satisfies NoticeState,
  })
}

/**
 * A live query here, unlike the onboarding gate in `App.tsx`.
 *
 * That one is read once at mount because a reactive read tore the flow down
 * when it saw its own completion write. Here the write hiding the strip *is*
 * the intent, and reactivity is what makes dismissing from Asetukset clear the
 * strip on Tänään without a reload.
 */
export function useNoticeSeen(): number {
  return useLiveQuery(readNoticeSeen, [], 0)
}
