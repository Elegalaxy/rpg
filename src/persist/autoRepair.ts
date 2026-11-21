import { repairCost } from '../content/shop.ts'
import type { ItemInstance } from '../sim/economy.ts'

import { selectedHero } from './character.ts'
import type { SaveData } from './save.ts'
import { repairOne } from './town.ts'

export type AutoRepairResult = { save: SaveData; repaired: number; gold: number; unaffordable: number }

/**
 * Auto run at home after a safe return (Step 13.49): with the hero's `autoRepair` on, repair the worn pieces, most worn first,
 * at the normal price and from the same gold as the manual Repair. A piece the gold does not cover is skipped. Archive pieces
 * are not touched. The save has no run (the finished one is settled). The one function the live loop and the away replay share.
 * Does nothing when the setting is off or a run is going.
 */
export function autoRepairStep(save: SaveData): AutoRepairResult {
  const none = { save, repaired: 0, gold: 0, unaffordable: 0 }
  const first = selectedHero(save)
  if (first === null || first.autoRepair !== true || save.expedition !== null) return none
  const worn = Object.values(first.equipment)
    .filter((item): item is ItemInstance => item !== null && repairCost(item) > 0)
    .sort((a, b) => b.maxDurability - b.durability - (a.maxDurability - a.durability))
  let current = save
  let repaired = 0
  let gold = 0
  let unaffordable = 0
  for (const item of worn) {
    const cost = repairCost(item)
    const result = repairOne(current, item.id)
    if (result.ok) {
      current = result.save
      repaired += 1
      gold += cost
    } else {
      unaffordable += 1
    }
  }
  return { save: current, repaired, gold, unaffordable }
}

/** "Repaired 3 pieces for 42 g." for the toast and the away report. */
export function repairLine(repaired: number, gold: number): string {
  return `Repaired ${repaired} ${repaired === 1 ? 'piece' : 'pieces'} for ${gold.toLocaleString('en-US')} g.`
}
