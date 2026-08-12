import { db } from '../db'
import {
  PATCHABLE_FIELDS,
  type CustomMovement,
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

/**
 * Seeded and user-authored movements read as one library. Custom rows carry
 * their edits in place, so they never appear in the override export — the build
 * script would only warn about ids it has never heard of.
 */
export async function listMovements(): Promise<EffectiveMovement[]> {
  const [movements, custom, overrides] = await Promise.all([
    db.movements.toArray(),
    db.customMovements.toArray(),
    db.overrides.toArray(),
  ])
  const byId = new Map(overrides.map((o) => [o.id, o]))
  return [
    ...movements.map((m) => merge(m, byId.get(m.id))),
    ...custom.map((m) => merge(m)),
  ]
}

/** The stored row, from whichever table owns it. */
async function baseMovement(
  id: string,
): Promise<{ row: Movement; custom: boolean } | undefined> {
  const seeded = await db.movements.get(id)
  if (seeded) return { row: seeded, custom: false }
  const own = await db.customMovements.get(id)
  return own ? { row: own, custom: true } : undefined
}

export async function getMovement(id: string): Promise<EffectiveMovement | undefined> {
  const base = await baseMovement(id)
  if (!base) return undefined
  if (base.custom) return merge(base.row)
  return merge(base.row, await db.overrides.get(id))
}

/** The seed value of a field, ignoring any override. Powers per-field reset. */
export async function seedValue<K extends keyof Patchable>(
  id: string,
  field: K,
): Promise<Patchable[K] | undefined> {
  const base = await baseMovement(id)
  if (!base) return undefined
  if (field === 'hidden') return false as Patchable[K]
  return base.row[field as keyof Movement] as Patchable[K]
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
  await db.transaction(
    'rw',
    db.movements,
    db.customMovements,
    db.overrides,
    async () => {
      // A user-authored movement has no seed to diff against, so edits land on
      // the row itself. That also keeps custom ids out of overrides.json.
      const own = await db.customMovements.get(id)
      if (own) {
        await db.customMovements.put({ ...own, ...changes })
        return
      }

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
    },
  )
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

/* --- user-authored movements --------------------------------------------- */

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'liike'

/**
 * Create a movement. Ids are prefixed so they can never collide with a seeded id
 * or with an entry in data/id-ledger.json.
 */
export async function createMovement(draft: {
  nameFi: string
  nameEn?: string
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  equipment?: string | null
  mechanic?: string | null
  force?: string | null
}): Promise<string> {
  const base = `oma-${slugify(draft.nameFi)}`
  let id = base
  for (let n = 2; await db.customMovements.get(id); n++) id = `${base}-${n}`

  const movement: CustomMovement = {
    id,
    custom: true,
    nameFi: draft.nameFi.trim(),
    nameEn: (draft.nameEn ?? draft.nameFi).trim(),
    primaryMuscles: draft.primaryMuscles ?? [],
    secondaryMuscles: draft.secondaryMuscles ?? [],
    equipment: draft.equipment ?? null,
    mechanic: draft.mechanic ?? null,
    force: draft.force ?? null,
    level: null,
    category: 'strength',
    instructions: [],
  }
  await db.customMovements.put(movement)
  return id
}

/** Whether any session references this movement — a delete would orphan history. */
export async function movementIsUsed(id: string): Promise<boolean> {
  const sessions = await db.sessions.toArray()
  if (sessions.some((s) => s.movements.some((m) => m.movementId === id))) return true
  const templates = await db.templates.toArray()
  return templates.some((t) => t.items.some((i) => i.movementId === id))
}

/**
 * Delete a user-authored movement, but only if nothing references it. A used one
 * must be hidden instead, or its history would stop resolving.
 */
export async function deleteMovement(id: string): Promise<{ deleted: boolean }> {
  if (!(await db.customMovements.get(id))) return { deleted: false }
  if (await movementIsUsed(id)) return { deleted: false }
  await db.customMovements.delete(id)
  await db.overrides.delete(id)
  return { deleted: true }
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
    if (!(await baseMovement(id))) {
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
