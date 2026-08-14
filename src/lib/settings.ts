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
const PROFILE_KEY = 'profile'

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

export interface Profile {
  name: string
}

export async function readProfile(): Promise<Profile> {
  const stored = (await db.meta.get(PROFILE_KEY))?.value as Profile | undefined
  return { name: stored?.name?.trim() ?? '' }
}

export async function writeProfile(profile: Profile): Promise<void> {
  await db.meta.put({ key: PROFILE_KEY, value: { name: profile.name.trim() } })
}

export function useProfile(): Profile {
  return useLiveQuery(readProfile, [], { name: '' })
}

/**
 * Whether the library is showing its editing controls.
 *
 * Persisted rather than component state: correcting the seeded Finnish names is a
 * sitting-down session across many movements, and a mode that reset every time
 * you came back from a movement page would be worse than no mode at all.
 */
export interface UiState {
  admin: boolean
}

const UI_KEY = 'ui'

export async function readUi(): Promise<UiState> {
  const stored = (await db.meta.get(UI_KEY))?.value as UiState | undefined
  return { admin: stored?.admin === true }
}

export async function writeUi(next: UiState): Promise<void> {
  await db.meta.put({ key: UI_KEY, value: next })
}

export function useUi(): UiState {
  return useLiveQuery(readUi, [], { admin: false })
}

/**
 * How the end of a rest period announces itself.
 *
 * Sound is off by default because a beep in a quiet gym is worse than no beep,
 * and notifications are off because permission has to be asked for deliberately
 * — never on load. Vibration is on: it is the only one that works with the phone
 * in a pocket, and the app already vibrates on the tick.
 */
export interface Alerts {
  vibrate: boolean
  sound: boolean
  notify: boolean
}

export const DEFAULT_ALERTS: Alerts = { vibrate: true, sound: false, notify: false }

const ALERTS_KEY = 'alerts'

export async function readAlerts(): Promise<Alerts> {
  const stored = (await db.meta.get(ALERTS_KEY))?.value as Partial<Alerts> | undefined
  return {
    vibrate: stored?.vibrate ?? DEFAULT_ALERTS.vibrate,
    sound: stored?.sound ?? DEFAULT_ALERTS.sound,
    notify: stored?.notify ?? DEFAULT_ALERTS.notify,
  }
}

export async function writeAlerts(next: Alerts): Promise<void> {
  await db.meta.put({ key: ALERTS_KEY, value: next })
}

export function useAlerts(): Alerts {
  return useLiveQuery(readAlerts, [], DEFAULT_ALERTS)
}
