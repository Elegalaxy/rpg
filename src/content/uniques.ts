import type { HeroClass } from '../sim/constants.ts'
import { ITEM_MAX_DURABILITY, type ItemInstance } from '../sim/economy.ts'
import type { UniqueItemDef, UniqueSlot } from '../sim/uniques.ts'

import { enemies } from './enemies.ts'
import { starterBaseIds } from './items.ts'
import { nodes } from './world.ts'

/** The quality every unique is paid at (the top of a crafted item's range). */
export const UNIQUE_QUALITY = 1.1

/** The base a unique is made on for a hero's class: the class's kind of armor, weapon or off-hand, or the accessory base the table names. */
export function uniqueBaseFor(def: UniqueItemDef, classId: HeroClass): string {
  if (def.baseId !== undefined) return def.baseId
  const starter = starterBaseIds(classId)
  if (def.slot === 'mainHand') return starter.mainHand
  if (def.slot === 'offHand') return starter.offHand
  if (def.slot === 'accessory') throw new Error(`unique '${def.id}' is an accessory with no base`)
  return `armor-${starter.armor}-${def.slot}`
}

/** The id of the item a hero is paid for a unique. */
export function uniqueItemId(heroId: string, def: UniqueItemDef): string {
  return `unique-${heroId}-${def.id}`
}

/** The item a hero is paid: its class's base at the table item level, quality 110%, the one fixed modifier, no socket, rank or temper. */
export function uniqueItemFor(heroId: string, def: UniqueItemDef, classId: HeroClass): ItemInstance {
  return {
    id: uniqueItemId(heroId, def),
    baseId: uniqueBaseFor(def, classId),
    itemLevel: def.itemLevel,
    quality: UNIQUE_QUALITY,
    durability: ITEM_MAX_DURABILITY,
    maxDurability: ITEM_MAX_DURABILITY,
    modifiers: [def.modifier],
    uniqueId: def.id,
  }
}

const SLOT_LABELS: { readonly [slot in UniqueSlot]: string } = {
  mainHand: 'Main hand',
  offHand: 'Off hand',
  head: 'Head',
  chest: 'Chest',
  hands: 'Hands',
  feet: 'Feet',
  accessory: 'Accessory',
}

export function uniqueSlotLabel(def: UniqueItemDef): string {
  return SLOT_LABELS[def.slot]
}

/** The elite that pays it, such as `Rootmaw Stalker`. */
export function uniqueSourceName(def: UniqueItemDef): string {
  return enemies[def.enemyId]?.name ?? def.enemyId
}

/** The zone the elite waits in, such as `Withered Grove`. Empty when no zone holds it. */
export function uniqueZoneName(def: UniqueItemDef): string {
  return Object.values(nodes).find((node) => node.encounterIds.includes(def.enemyId))?.name ?? ''
}
