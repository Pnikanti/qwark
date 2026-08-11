import Dexie, { type Table } from 'dexie'
import seed from '../data/movements.seed.json'
import type { Movement, MovementOverride } from './types'

/** Bump when data/movements.seed.json changes so the library re-seeds. */
const SEED_VERSION = 1

interface Meta {
  key: string
  value: unknown
}

class QwarkDB extends Dexie {
  /** Seed rows. Replaced wholesale on re-seed; never mutated in place. */
  movements!: Table<Movement, string>
  /** Admin edits, one row per patched movement. Survives re-seeding. */
  overrides!: Table<MovementOverride, string>
  meta!: Table<Meta, string>

  constructor() {
    super('qwark')
    this.version(1).stores({
      movements: 'id, nameFi, nameEn, equipment, *primaryMuscles',
      overrides: 'id, updatedAt',
      meta: 'key',
    })
  }
}

export const db = new QwarkDB()

async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

/**
 * Load the seed into IndexedDB. Idempotent, and deliberately leaves the
 * overrides table alone — that is the whole point of the two-layer split.
 */
export async function ensureSeeded(): Promise<void> {
  const installed = await getMeta<number>('seedVersion')
  if (installed === SEED_VERSION && (await db.movements.count()) > 0) return

  await db.transaction('rw', db.movements, db.meta, async () => {
    await db.movements.clear()
    await db.movements.bulkPut(seed as Movement[])
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
  })
}
