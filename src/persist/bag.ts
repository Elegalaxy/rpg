import { haulerPiecesWorn } from '../sim/economy.ts'
import { LOOT_CAPACITY, MAX_LOOT_CAPACITY } from '../sim/expedition.ts'

import type { SavedHero } from './save.ts'

/** Bag room added at each of these hero levels (GAME_DESIGN §8, Batch C). */
export const BAG_LEVEL_STEPS: readonly number[] = [10, 20, 30]
export const BAG_ROOM_PER_LEVEL_STEP = 2
/** Room from each Hauler's modifier on worn gear, and how many pieces count. */
export const HAULER_ROOM = 3
export const HAULER_STACK_CAP = 2
/** The Legacy purchase Deep Pockets. */
export const DEEP_POCKETS_ROOM = 4
export const DEEP_POCKETS_COST = 15

/** Pieces of worn gear with the Hauler's modifier that count (at most 2). */
export function haulerPieces(hero: SavedHero): number {
  return haulerPiecesWorn(hero.equipment)
}

/** The bag room a hero starts a run with: 20, +2 at levels 10/20/30, +3 per Hauler's piece (at most 2), +4 for Deep Pockets, at most 36. */
export function bagCapacity(hero: SavedHero): number {
  const level = hero.progress.level
  const fromLevel = BAG_LEVEL_STEPS.filter((step) => level >= step).length * BAG_ROOM_PER_LEVEL_STEP
  const fromGear = Math.min(haulerPieces(hero), HAULER_STACK_CAP) * HAULER_ROOM
  const fromLegacy = hero.purchases.deepPockets ? DEEP_POCKETS_ROOM : 0
  return Math.min(MAX_LOOT_CAPACITY, LOOT_CAPACITY + fromLevel + fromGear + fromLegacy)
}
