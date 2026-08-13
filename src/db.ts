import Dexie, { type Table } from 'dexie'
import movementSeed from '../data/movements.seed.json'
import templateSeed from '../data/templates.seed.json'
import { localDay } from './lib/format'
import type {
  CustomMovement,
  Movement,
  MovementOverride,
  Session,
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
