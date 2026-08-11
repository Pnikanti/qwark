/** Bar and available discs, in kg. Gym inventory varies — this belongs in
 *  settings eventually, since progression steps depend on the smallest pair. */
export const BAR_KG = 20
export const DISCS = [25, 20, 15, 10, 5, 2.5, 1.25] as const

/** Smallest change you can actually make: a pair of the lightest discs. */
export const STEP_KG = DISCS[DISCS.length - 1] * 2

export interface PlateLoad {
  /** Discs for ONE side, heaviest first. */
  perSide: number[]
  /** Kg that cannot be made with the available discs. */
  remainder: number
  achievable: number
}

/**
 * Greedy per-side breakdown. Greedy is exact for this disc set because every
 * disc divides evenly into the larger ones down to 1.25.
 */
export function platesFor(totalKg: number, barKg = BAR_KG): PlateLoad | null {
  if (!Number.isFinite(totalKg) || totalKg < barKg) return null

  let perSideKg = (totalKg - barKg) / 2
  const perSide: number[] = []
  for (const disc of DISCS) {
    while (perSideKg >= disc - 1e-9) {
      perSide.push(disc)
      perSideKg -= disc
    }
  }
  const remainder = Math.round(perSideKg * 2 * 100) / 100
  return { perSide, remainder, achievable: Math.round((totalKg - remainder) * 100) / 100 }
}

/** Round to something the bar can actually hold. */
export function snapToBar(totalKg: number, barKg = BAR_KG): number {
  if (totalKg <= barKg) return barKg
  const steps = Math.round((totalKg - barKg) / STEP_KG)
  return Math.round((barKg + steps * STEP_KG) * 100) / 100
}

/** Token name for a disc, so the UI colours it like the real thing. */
export function discToken(disc: number): string {
  if (disc >= 25) return 'var(--plate-25)'
  if (disc >= 20) return 'var(--plate-20)'
  if (disc >= 15) return 'var(--plate-15)'
  if (disc >= 10) return 'var(--plate-10)'
  return 'var(--plate-5)'
}
