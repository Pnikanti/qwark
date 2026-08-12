import type { GymSettings } from '../types'

export interface PlateLoad {
  /** Discs for ONE side, heaviest first. */
  perSide: number[]
  /** Kg that cannot be made with the discs on hand. */
  remainder: number
  achievable: number
}

/** Smallest change the gym can actually make: a pair of its lightest discs. */
export function stepKg(gym: GymSettings): number {
  return Math.min(...gym.discs) * 2
}

/**
 * Greedy per-side breakdown.
 *
 * Greedy is exact for a set where each disc divides evenly into the larger ones
 * (25/20/15/10/5/2.5/1.25 does). A gym with an odd set can leave a remainder
 * that a smarter search would resolve; the remainder is surfaced rather than
 * hidden, so the UI can offer a rounding instead of quietly lying.
 */
export function platesFor(totalKg: number, gym: GymSettings): PlateLoad | null {
  if (!Number.isFinite(totalKg) || totalKg < gym.barKg) return null

  let perSideKg = (totalKg - gym.barKg) / 2
  const perSide: number[] = []
  for (const disc of [...gym.discs].sort((a, b) => b - a)) {
    while (perSideKg >= disc - 1e-9) {
      perSide.push(disc)
      perSideKg -= disc
    }
  }
  const remainder = Math.round(perSideKg * 2 * 100) / 100
  return {
    perSide,
    remainder,
    achievable: Math.round((totalKg - remainder) * 100) / 100,
  }
}

/**
 * Nearest load this gym can make, for any implement.
 *
 * Above the bar, loads sit on the bar's grid. Below it — dumbbells, cables,
 * machines — they sit on the plate-pair grid instead. `snapToBar` clamps
 * everything lighter than the bar *up to* the bar, which is right when you are
 * loading a barbell and very wrong for a 10 kg dumbbell curl.
 */
export function snapLoad(totalKg: number, gym: GymSettings): number {
  if (totalKg <= 0) return 0
  const step = stepKg(gym)
  if (totalKg >= gym.barKg) {
    const steps = Math.round((totalKg - gym.barKg) / step)
    return Math.round((gym.barKg + steps * step) * 100) / 100
  }
  return Math.round(Math.max(0, Math.round(totalKg / step) * step) * 100) / 100
}

/** Round to a load a *barbell* can hold. Used by the pad's plate calculator. */
export function snapToBar(totalKg: number, gym: GymSettings): number {
  if (totalKg <= gym.barKg) return gym.barKg
  const step = stepKg(gym)
  const steps = Math.round((totalKg - gym.barKg) / step)
  return Math.round((gym.barKg + steps * step) * 100) / 100
}

/** Token for a disc, so the UI colours it like the real thing. */
export function discToken(disc: number): string {
  if (disc >= 25) return 'var(--plate-25)'
  if (disc >= 20) return 'var(--plate-20)'
  if (disc >= 15) return 'var(--plate-15)'
  if (disc >= 10) return 'var(--plate-10)'
  return 'var(--plate-5)'
}
