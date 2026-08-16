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
  /** Position in the group's cycle. Key order is alphabetical and loses it. */
  order: number
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
  /** Absolute instant, epoch ms — timezone-independent. */
  startedAt: number
  /**
   * The local calendar day this session belonged to, `YYYY-MM-DD`, captured when
   * it started. `startedAt` alone is not enough: bucketing it by the *viewing*
   * device's midnight moves a late-evening session to another day if you open
   * the app in a different timezone.
   */
  startedLocalDay: string
  /**
   * Logged after the fact, for a day that had already passed. Such a session has
   * no measured duration. Explicit rather than derived: a session that runs past
   * midnight also starts on a different day from the one it finishes on.
   */
  retro?: boolean
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

/**
 * One bodyweight reading.
 *
 * A table rather than a number on the profile, because bodyweight is an
 * observation with a date and not a setting: TODO.md wants it smoothed over
 * time, and a scalar would have to be migrated into a series later with no
 * timestamp to migrate — the app would have to invent one.
 *
 * Keyed on the local day so re-weighing yourself in the evening corrects the
 * morning's entry instead of stacking a second one, the same reason
 * `Session.startedLocalDay` exists.
 */
export interface BodyMetric {
  day: string
  at: number
  kg: number
}

/* --- dialogue ------------------------------------------------------------ */

/**
 * Why working sets fell short.
 *
 * What the user *said*, never what the app does about it — the consequence is
 * derived in `progression.ts`, so the record stays a record and the rule stays
 * inspectable. There is deliberately no "it felt easy": after two sessions of
 * missing target, a chip the log contradicts invites a false claim.
 */
export type ShortfallCause = 'load' | 'day' | 'unsure'

export interface MovementAnswer {
  /** Which question this answers. One member today; it is what makes a stored
   *  answer self-describing when a second question type arrives. */
  turn: 'shortfall'
  value: ShortfallCause
  at: number
}

/**
 * Answers for one session, one row, written whole.
 *
 * Its own table rather than a field on `Session`: `finishSession` does a
 * read-modify-put of the entire session row, so a write from the summary screen
 * would race it — and a whole-object write silently dropping fields is a bug
 * this repo has already had once, in `writeProfile`.
 *
 * Sparse and keyed by movementId, because at most three movements are ever
 * asked about. `at` is when the answer was given, not when the session happened.
 */
export interface SessionFeedback {
  sessionId: string
  at: number
  answers: Record<string, MovementAnswer>
  /** Script generation, so a later rewrite can tell what it is reading. */
  script: number
}
