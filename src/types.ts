/** A movement as it comes out of scripts/build-movements.py. Seed rows are
 *  immutable — admin edits live in MovementOverride and merge at read time. */
export interface Movement {
  /** Canonical, opaque, pinned in data/id-ledger.json. Never edit or parse it. */
  id: string
  nameFi: string | null
  nameEn: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  equipment: string | null
  mechanic: string | null
  force: string | null
  level: string | null
  category: string | null
  instructions: string[]
}

/** Fields an admin may patch. `id` is absent by design: logged sets reference
 *  it, so it must survive a rename of either name. */
export type Patchable = Pick<
  Movement,
  | 'nameFi'
  | 'nameEn'
  | 'primaryMuscles'
  | 'secondaryMuscles'
  | 'equipment'
  | 'mechanic'
  | 'force'
  | 'level'
  | 'category'
  | 'instructions'
> & { hidden: boolean }

export const PATCHABLE_FIELDS = [
  'nameFi',
  'nameEn',
  'primaryMuscles',
  'secondaryMuscles',
  'equipment',
  'mechanic',
  'force',
  'level',
  'category',
  'instructions',
  'hidden',
] as const satisfies readonly (keyof Patchable)[]

export interface MovementOverride {
  id: string
  /** Only fields that actually differ from the seed, so the export stays a diff. */
  patch: Partial<Patchable>
  updatedAt: number
}

/** A seed row with its override applied. What every screen reads. */
export type EffectiveMovement = Movement & {
  hidden?: boolean
  /** Which fields came from an override rather than the seed. */
  edited: ReadonlySet<keyof Patchable>
}

export interface Taxonomy {
  muscles: Record<string, string>
  equipment: Record<string, string>
}
