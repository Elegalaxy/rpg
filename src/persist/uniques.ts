import { uniqueItemFor } from '../content/uniques.ts'
import { EQUIPMENT_SLOT_IDS, type ItemInstance } from '../sim/economy.ts'
import { UNIQUE_ITEMS, uniqueDef, type UniqueItemDef } from '../sim/uniques.ts'

import type { SavedHero } from './save.ts'

/**
 * Elite uniques (GAME_DESIGN section 9, Step 14.6). The first time a hero defeats an elite and gets home safely, that hero is paid
 * one named unique item into its archive. This file only decides what is due and pays it; `settleExpedition` calls it on a safe
 * return. The ledger is the hero's `firstClearIds`, so each unique is paid once per hero ever, and a sold or lost one stays gone.
 */

/** The id recorded in `firstClearIds` once a unique has been paid. */
export function uniqueRewardId(uniqueId: string): string {
  return `unique:${uniqueId}`
}

export function isUniqueRewardId(id: string): boolean {
  return id.startsWith('unique:')
}

/** The unique an id such as `unique:rootmaw-treads` names, or undefined. */
export function uniqueForRewardId(id: string): UniqueItemDef | undefined {
  return isUniqueRewardId(id) ? uniqueDef(id.slice('unique:'.length)) : undefined
}

/**
 * The uniques this hero is owed, in table order: the elite is in this life's `defeatedEnemyIds` (elites remembered from earlier
 * lives do not pay) and its ledger id is not in `firstClearIds`. Old saves are paid retroactively at the next safe return.
 */
export function uniquesDue(hero: SavedHero): UniqueItemDef[] {
  const paid = hero.firstClearIds ?? []
  return UNIQUE_ITEMS.filter((def) => hero.defeatedEnemyIds.includes(def.enemyId) && !paid.includes(uniqueRewardId(def.id)))
}

function heldItems(hero: SavedHero): ItemInstance[] {
  const held: ItemInstance[] = [...hero.purse.archive]
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = hero.equipment[slot]
    if (item !== null) held.push(item)
  }
  for (const job of hero.purse.craftQueue) if ('item' in job) held.push(job.item)
  return held
}

/** Whether the hero holds a unique: worn, in the archive or held by a craft job. */
export function holdsUnique(hero: SavedHero, uniqueId: string): boolean {
  return heldItems(hero).some((item) => item.uniqueId === uniqueId)
}

/** The uniques `now` holds that `was` did not, in table order: what a safe return just paid. Empty without both heroes. */
export function uniquesGained(was: SavedHero | null, now: SavedHero | null): UniqueItemDef[] {
  if (was === null || now === null) return []
  return UNIQUE_ITEMS.filter((def) => holdsUnique(now, def.id) && !holdsUnique(was, def.id))
}

/**
 * Pay everything due: each unique goes to the archive and its ledger id is recorded. A unique the hero already holds (worn, in the
 * archive or in a craft job) is only recorded, so nothing is created twice. The same hero object when nothing is due.
 */
export function payUniques(hero: SavedHero): { hero: SavedHero; paid: UniqueItemDef[] } {
  const due = uniquesDue(hero)
  if (due.length === 0) return { hero, paid: [] }
  const held = heldItems(hero)
  const created: ItemInstance[] = []
  const paid: UniqueItemDef[] = []
  for (const def of due) {
    if (held.some((item) => item.uniqueId === def.id)) continue
    created.push(uniqueItemFor(hero.id, def, hero.classId))
    paid.push(def)
  }
  return {
    hero: {
      ...hero,
      purse: created.length === 0 ? hero.purse : { ...hero.purse, archive: [...hero.purse.archive, ...created] },
      firstClearIds: [...(hero.firstClearIds ?? []), ...due.map((def) => uniqueRewardId(def.id))],
    },
    paid,
  }
}
