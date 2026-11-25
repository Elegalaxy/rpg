import type { ArmorSlot } from './constants.ts'
import { roundBonus, type ItemInstance, type StatBonuses } from './economy.ts'

/**
 * Elite uniques (GAME_DESIGN section 9, Step 14.6). A hero's first safe-return defeat of an elite pays one named item:
 * a normal crafted-style item with one fixed modifier and one signature bonus. The signature is not a modifier (no
 * stack cap, rank or temper); it only shrinks when the item is below its table level. The sim reads it in
 * `gearBonusesFor` and nowhere else.
 */

/** Where a unique is worn. The accessory goes in the first free accessory slot. */
export type UniqueSlot = 'mainHand' | 'offHand' | ArmorSlot | 'accessory'

export type UniqueItemDef = {
  id: string
  name: string
  /** The elite whose first defeat pays it. */
  enemyId: string
  itemLevel: number
  slot: UniqueSlot
  /** Accessories only: the base is the same for every class. Other slots follow the hero's class. */
  baseId?: string
  /** The one fixed modifier, in slot 0. */
  modifier: string
  signatureName: string
  /** Full-strength bonuses, at item level `itemLevel` or above. */
  signature: StatBonuses
  /** The signature in words at full strength. */
  signatureText: string
}

/** The six uniques, in the order of the elites. */
export const UNIQUE_ITEMS: readonly UniqueItemDef[] = [
  {
    id: 'rootmaw-treads',
    name: 'Rootmaw Treads',
    enemyId: 'rootmaw-stalker',
    itemLevel: 14,
    slot: 'feet',
    modifier: 'nimble',
    signatureName: "Stalker's Step",
    signature: { evasionBonus: 1.5, accuracyBonus: 1.5 },
    signatureText: '+1.5 Evasion, +1.5 Accuracy',
  },
  {
    id: 'echoing-visor',
    name: 'Echoing Visor',
    enemyId: 'echo-knight',
    itemLevel: 16,
    slot: 'head',
    modifier: 'sturdy',
    signatureName: 'Echo',
    signature: { cooldownReductionBonus: 0.01, magicalStatusResistanceBonus: 2.5 },
    signatureText: '+1 point cooldown reduction, +2.5 magical status resistance',
  },
  {
    id: 'tidebound-carapace',
    name: 'Tidebound Carapace',
    enemyId: 'tidebound-colossus',
    itemLevel: 22,
    slot: 'chest',
    modifier: 'stalwart',
    signatureName: 'Undertow',
    signature: { maxHpBonus: 0.02, physicalStatusResistanceBonus: 1.5 },
    signatureText: '+2% maximum HP, +1.5 physical status resistance',
  },
  {
    id: 'hollowmaw-fang',
    name: 'Hollowmaw Fang',
    enemyId: 'hollowmaw-reaver',
    itemLevel: 26,
    slot: 'mainHand',
    modifier: 'bloodbound',
    signatureName: 'Gorge',
    signature: { critChanceBonus: 0.01, critDamageBonus: 0.075 },
    signatureText: '+1 point critical chance, +7.5 points critical damage',
  },
  {
    id: 'emberwrought-heart',
    name: 'Emberwrought Heart',
    enemyId: 'emberwrought-tyrant',
    itemLevel: 32,
    slot: 'offHand',
    modifier: 'kindled',
    signatureName: 'Banked Fire',
    signature: { magicalStatusResistanceBonus: 10, armorPenetrationBonus: 0.04, magicalPenetrationBonus: 0.04 },
    signatureText: '+10 magical status resistance, +4 points armor and magical penetration',
  },
  {
    id: 'briarheart-talisman',
    name: 'Briarheart Talisman',
    enemyId: 'briar-matriarch',
    itemLevel: 38,
    slot: 'accessory',
    baseId: 'accessory-talisman',
    modifier: 'staunch',
    signatureName: 'Thornblood',
    signature: { physicalStatusResistanceBonus: 5, maxHpBonus: 0.015 },
    signatureText: '+5 physical status resistance, +1.5% maximum HP',
  },
]

/** The table row for a unique id, or undefined for an absent or unknown id (such an item is plain). */
export function uniqueDef(id: string | undefined): UniqueItemDef | undefined {
  return id === undefined ? undefined : UNIQUE_ITEMS.find((def) => def.id === id)
}

/** The share of the signature an item keeps: 1 at its table level or above, less below it. Quality, rank and temper never matter. */
export function uniqueScale(item: ItemInstance): number {
  const def = uniqueDef(item.uniqueId)
  return def === undefined ? 0 : Math.min(1, item.itemLevel / def.itemLevel)
}

/** The signature bonuses of one item at its item level. Empty when it is not a known unique. */
export function uniqueSignature(item: ItemInstance): StatBonuses {
  const def = uniqueDef(item.uniqueId)
  if (def === undefined) return {}
  const scale = uniqueScale(item)
  const bonuses: { [key in keyof StatBonuses]: number } = {}
  for (const key of Object.keys(def.signature) as (keyof StatBonuses)[]) {
    const value = def.signature[key] ?? 0
    bonuses[key] = scale >= 1 ? value : roundBonus(key, value * scale)
  }
  return bonuses
}

/** The signature in words with every figure scaled to the item's level and rounded to one decimal. Empty for a plain item. */
export function uniqueSignatureText(item: ItemInstance): string {
  const def = uniqueDef(item.uniqueId)
  if (def === undefined) return ''
  const scale = uniqueScale(item)
  if (scale >= 1) return def.signatureText
  return def.signatureText.replace(/\d+(\.\d+)?/g, (digits) => String(Math.round(Number(digits) * scale * 10) / 10))
}
