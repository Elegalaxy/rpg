import { FIRST_CLEAR_NODE_IDS, firstClearReward, type FirstClearReward } from '../content/firstClear.ts'
import type { SavedHero } from './save.ts'

/**
 * First-clear rewards (GAME_DESIGN §9, Step 13.24). A node the hero has cleared that has not been paid yet is
 * due. Payment happens when a run ends in a safe return (`settleExpedition`); this file knows nothing about runs.
 */

/** The rewards this hero is owed, in node order: cleared nodes with a reward that are not in `firstClearIds`. */
export function firstClearsDue(hero: SavedHero): FirstClearReward[] {
  const paid = hero.firstClearIds ?? []
  return FIRST_CLEAR_NODE_IDS.flatMap((id) => {
    const reward = firstClearReward(id)
    return reward === null || paid.includes(id) || !hero.clearedNodeIds.includes(id) ? [] : [reward]
  })
}

/** Pay everything due into the hero's purse and free upgrades, and record it. The same hero object when nothing is due. */
export function payFirstClears(hero: SavedHero): { hero: SavedHero; paid: FirstClearReward[] } {
  const due = firstClearsDue(hero)
  if (due.length === 0) return { hero, paid: [] }
  const materials = { ...hero.purse.materials }
  let gold = hero.purse.gold
  let tokens = hero.freeUpgrades ?? 0
  for (const reward of due) {
    gold += reward.gold
    if (reward.materialId !== null) materials[reward.materialId] = (materials[reward.materialId] ?? 0) + reward.quantity
    tokens += reward.tokens
  }
  return {
    hero: {
      ...hero,
      purse: { ...hero.purse, gold, materials },
      freeUpgrades: tokens,
      firstClearIds: [...(hero.firstClearIds ?? []), ...due.map((reward) => reward.nodeId)],
    },
    paid: due,
  }
}
