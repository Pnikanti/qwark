import { db } from '../db'
import {
  PATCHABLE_FIELDS,
  type EffectiveMovement,
  type Movement,
  type MovementOverride,
  type Patchable,
} from '../types'

const EMPTY: ReadonlySet<keyof Patchable> = new Set()

/** Apply an override to a seed row. This is the only way screens read a movement. */
export function merge(
  movement: Movement,
  override?: MovementOverride,
): EffectiveMovement {
  if (!override || Object.keys(override.patch).length === 0) {
    return { ...movement, edited: EMPTY }
  }
  return {
    ...movement,
    ...override.patch,
    edited: new Set(Object.keys(override.patch) as (keyof Patchable)[]),
  }
}

export async function listMovements(): Promise<EffectiveMovement[]> {
  const [movements, overrides] = await Promise.all([
    db.movements.toArray(),
    db.overrides.toArray(),
  ])
  const byId = new Map(overrides.map((o) => [o.id, o]))
  return movements.map((m) => merge(m, byId.get(m.id)))
}

export async function getMovement(id: string): Promise<EffectiveMovement | undefined> {
  const movement = await db.movements.get(id)
  if (!movement) return undefined
  return merge(movement, await db.overrides.get(id))
}

/** The seed value of a field, ignoring any override. Powers per-field reset. */
export async function seedValue<K extends keyof Patchable>(
  id: string,
  field: K,
): Promise<Patchable[K] | undefined> {
  const movement = await db.movements.get(id)
  if (!movement) return undefined
  if (field === 'hidden') return false as Patchable[K]
  return movement[field as keyof Movement] as Patchable[K]
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i])
  }
  return a === b
}

/**
 * Write an edit. Only fields that genuinely differ from the seed are stored, so
 * the override set stays a minimal diff and the export stays readable. Setting a
 * field back to its seed value drops it from the patch; emptying the patch drops
 * the override row entirely.
 */
export async function patchMovement(
  id: string,
  changes: Partial<Patchable>,
): Promise<void> {
  await db.transaction('rw', db.movements, db.overrides, async () => {
    const movement = await db.movements.get(id)
    if (!movement) throw new Error(`unknown movement: ${id}`)

    const existing = await db.overrides.get(id)
    const patch: Partial<Patchable> = { ...existing?.patch, ...changes }

    for (const field of PATCHABLE_FIELDS) {
      if (!(field in patch)) continue
      const seeded =
        field === 'hidden' ? false : (movement[field as keyof Movement] as unknown)
      if (sameValue(patch[field], seeded)) delete patch[field]
    }

    if (Object.keys(patch).length === 0) {
      await db.overrides.delete(id)
      return
    }
    await db.overrides.put({ id, patch, updatedAt: Date.now() })
  })
}

/** Drop a single field's override, reverting it to the seed value. */
export async function resetField(id: string, field: keyof Patchable): Promise<void> {
  await db.transaction('rw', db.overrides, async () => {
    const existing = await db.overrides.get(id)
    if (!existing) return
    const patch = { ...existing.patch }
    delete patch[field]
    if (Object.keys(patch).length === 0) {
      await db.overrides.delete(id)
      return
    }
    await db.overrides.put({ id, patch, updatedAt: Date.now() })
  })
}

/** Serialise overrides in the exact shape scripts/build-movements.py consumes. */
export async function exportOverrides(): Promise<string> {
  const overrides = await db.overrides.orderBy('id').toArray()
  const out: Record<string, Partial<Patchable>> = {}
  for (const o of overrides) out[o.id] = o.patch
  return JSON.stringify(out, null, 2) + '\n'
}

/** Load a data/overrides.json file back in. Unknown ids are reported, not applied. */
export async function importOverrides(json: string): Promise<{
  applied: number
  unknown: string[]
}> {
  const parsed = JSON.parse(json) as Record<string, Partial<Patchable>>
  const unknown: string[] = []
  let applied = 0

  for (const [id, patch] of Object.entries(parsed)) {
    if (!(await db.movements.get(id))) {
      unknown.push(id)
      continue
    }
    await patchMovement(id, patch)
    applied++
  }
  return { applied, unknown }
}

/** Movements the admin should look at: missing a Finnish name or key metadata. */
export function needsReview(m: EffectiveMovement): boolean {
  return !m.nameFi || !m.mechanic || !m.force || !m.equipment
}
