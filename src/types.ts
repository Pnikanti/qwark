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

/* --- training ------------------------------------------------------------ */

export type SetKind = 'warmup' | 'working'

export interface TemplateItem {
  movementId: string
  sets: number
  targetReps: number | null
  restSeconds: number | null
}

export interface Template {
  id: string
  /** Groups routines into a programme on Tänään, e.g. "Työntö / Veto / Jalat". */
  group: string | null
  name: string
  items: TemplateItem[]
  /** Seeded routines are replaceable on re-seed; saved ones are the user's. */
  seeded: boolean
  createdAt: number
}

export interface LoggedSet {
  kind: SetKind
  kg: number | null
  reps: number | null
  done: boolean
  completedAt: number | null
}

export interface SessionMovement {
  /** Stable identity for this entry. Order is the array's order, but the active
   *  entry and React keys must survive a reorder, and the same movement can
   *  appear twice in one session. */
  uid: string
  movementId: string
  targetReps: number | null
  /** Working sets the routine calls for. null for a movement added ad hoc. */
  plannedSets: number | null
  restSeconds: number | null
  /**
   * Completed sets, plus exactly one trailing draft (`done: false`) while the
   * session is open — the draft is the input the user types into, so it has to
   * persist like everything else. `finishSession` drops it.
   */
  sets: LoggedSet[]
  note: string | null
}

/**
 * A session copies its plan from the template at start, so editing the template
 * afterwards cannot rewrite what was actually done. Movement *names* still
 * resolve live through movementId — the id is canonical, so a rename is meant
 * to show up in history.
 */
export interface Session {
  id: string
  templateId: string | null
  /** Snapshot: renaming a routine must not relabel past sessions. */
  templateName: string | null
  startedAt: number
  finishedAt: number | null
  movements: SessionMovement[]
}

/* --- gym setup ----------------------------------------------------------- */

/**
 * What the gym actually has. The plate calculator, the pad's steppers, and the
 * smallest progression step all derive from this, so a wrong value here makes
 * the app confidently misleading rather than merely imprecise.
 */
export interface GymSettings {
  barKg: number
  /** Disc sizes available, in kg. Order does not matter; sorted on read. */
  discs: number[]
}

/**
 * A movement the user created. Kept in its own table because ensureSeeded()
 * clears and repopulates `movements` — anything user-authored in there would be
 * destroyed by the next seed bump.
 */
export type CustomMovement = Movement & { custom: true }
