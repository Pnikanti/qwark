import Dexie, { type Table } from 'dexie'
import movementSeed from '../data/movements.seed.json'
import templateSeed from '../data/templates.seed.json'
import { localDay } from './lib/format'
import type {
  BodyMetric,
  CustomMovement,
  Movement,
  MovementOverride,
  Session,
  SessionFeedback,
  Template,
} from './types'

/** Bump when data/movements.seed.json changes so the library re-seeds. */
const MOVEMENT_SEED_VERSION = 1
/** Bump when data/templates.seed.json changes. */
const TEMPLATE_SEED_VERSION = 2

interface Meta {
  key: string
  value: unknown
}

class QwarkDB extends Dexie {
  /** Seed rows. Replaced wholesale on re-seed; never mutated in place. */
  movements!: Table<Movement, string>
  /** Admin edits, one row per patched movement. Survives re-seeding. */
  overrides!: Table<MovementOverride, string>
  /** User-authored movements. Untouched by seeding, unlike `movements`. */
  customMovements!: Table<CustomMovement, string>
  templates!: Table<Template, string>
  sessions!: Table<Session, string>
  /** Bodyweight over time, one row per local day. */
  bodyMetrics!: Table<BodyMetric, string>
  /** Answers given to the Ensi kerralle sheet, one row per session. */
  sessionFeedback!: Table<SessionFeedback, string>
  meta!: Table<Meta, string>

  constructor() {
    super('qwark')
    this.version(1).stores({
      movements: 'id, nameFi, nameEn, equipment, *primaryMuscles',
      overrides: 'id, updatedAt',
      meta: 'key',
    })
    this.version(2).stores({
      movements: 'id, nameFi, nameEn, equipment, *primaryMuscles',
      overrides: 'id, updatedAt',
      // `seeded` is deliberately not indexed — Dexie cannot index booleans.
      templates: 'id, name, group',
      sessions: 'id, startedAt, finishedAt, templateId',
      meta: 'key',
    })
    // Backfill stable per-entry ids so reordering cannot lose track of which
    // movement is active. Schema is unchanged; only the row shape moves on.
    this.version(3).upgrade((tx) =>
      tx
        .table<Session>('sessions')
        .toCollection()
        .modify((session) => {
          session.movements.forEach((m, i) => {
            if (!m.uid) m.uid = `m${session.startedAt}-${i}`
          })
        }),
    )
    this.version(4).stores({
      customMovements: 'id, nameFi, nameEn, equipment, *primaryMuscles',
    })
    /**
     * Sets used to be pre-created one row per planned set, so the plan was implied
     * by how many empty rows existed. Now the plan is explicit and `sets` holds
     * actuals plus a single trailing draft.
     */
    this.version(5).upgrade((tx) =>
      tx
        .table<Session>('sessions')
        .toCollection()
        .modify((session) => {
          for (const m of session.movements) {
            if (m.plannedSets === undefined || m.plannedSets === null) {
              m.plannedSets = m.sets.length || null
            }
            if (session.finishedAt !== null) continue
            // Collapse the pre-created empties down to one draft.
            const done = m.sets.filter((s) => s.done)
            const draft = m.sets.find((s) => !s.done)
            m.sets = draft ? [...done, draft] : done
          }
        }),
    )
    /** Record the local day each session belonged to; see Session.startedLocalDay. */
    this.version(6).upgrade((tx) =>
      tx
        .table<Session>('sessions')
        .toCollection()
        .modify((session) => {
          session.startedLocalDay ??= localDay(session.startedAt)
        }),
    )
    /**
     * Bodyweight, from onboarding onward. `.stores()` is a delta, so declaring
     * only the new table leaves the rest untouched and no upgrade function is
     * needed — the same shape as version 4.
     */
    this.version(7).stores({ bodyMetrics: 'day, at' })
    /**
     * Dialogue answers. Additive delta again, so no upgrade function and nothing
     * to backfill: a session with no row reads as unanswered, which is exactly
     * the behaviour before this table existed.
     */
    this.version(8).stores({ sessionFeedback: 'sessionId, at' })
    /**
     * The draft is a working set now, and there is no longer a control that can
     * turn one into the other.
     *
     * Every movement used to open on Lämmittely, so a session left open across
     * this upgrade carries a warmup draft — and `commitSet` copies the committed
     * kind into the next draft, so that one warmup would make every remaining set
     * of the session a warmup, counted towards nothing, with no way back. Only the
     * trailing draft is touched: it is the input, not a record, and warmups
     * already logged are exactly what the user meant.
     */
    this.version(9).upgrade((tx) =>
      tx
        .table<Session>('sessions')
        .toCollection()
        .modify((session) => {
          if (session.finishedAt !== null) return
          for (const m of session.movements) {
            const draft = m.sets.at(-1)
            if (!draft || draft.done || draft.kind === 'working') continue
            draft.kind = 'working'
            draft.reps ??= m.targetReps
          }
        }),
    )
  }
}

export const db = new QwarkDB()

async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

/**
 * Load seed data into IndexedDB. Idempotent, and deliberately leaves the
 * overrides and sessions tables alone — that is the whole point of the split.
 * Re-seeding templates replaces the seeded rows only; saved routines survive.
 */
export async function ensureSeeded(): Promise<void> {
  if (
    (await getMeta<number>('movementSeedVersion')) !== MOVEMENT_SEED_VERSION ||
    (await db.movements.count()) === 0
  ) {
    await db.transaction('rw', db.movements, db.meta, async () => {
      await db.movements.clear()
      await db.movements.bulkPut(movementSeed as Movement[])
      await db.meta.put({ key: 'movementSeedVersion', value: MOVEMENT_SEED_VERSION })
    })
  }

  if ((await getMeta<number>('templateSeedVersion')) !== TEMPLATE_SEED_VERSION) {
    await db.transaction('rw', db.templates, db.meta, async () => {
      const stale = await db.templates.filter((t) => t.seeded).primaryKeys()
      await db.templates.bulkDelete(stale)
      await db.templates.bulkPut(
        (templateSeed as Omit<Template, 'seeded' | 'createdAt'>[]).map((t) => ({
          ...t,
          seeded: true,
          createdAt: 0,
        })),
      )
      await db.meta.put({ key: 'templateSeedVersion', value: TEMPLATE_SEED_VERSION })
    })
  }
}
