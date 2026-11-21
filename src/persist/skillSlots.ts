import { LOADOUT_SLOT_COUNT, MAX_LOADOUT_SLOTS } from '../sim/progression.ts'

import type { HeroPurchases } from './save.ts'

/** How many skills this hero may equip: five with the Fifth Skill Slot (Step 13.34), otherwise four. */
export function loadoutSlots(hero: { purchases: HeroPurchases }): number {
  return hero.purchases.fifthSlot === true ? MAX_LOADOUT_SLOTS : LOADOUT_SLOT_COUNT
}

/** How many past lives' loadouts a hero keeps, newest first (Step 13.42). */
export const MAX_PAST_SETUPS = 3
