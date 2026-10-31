import type { ItemInstance } from '../sim/economy.ts'

import { itemBases } from './items.ts'

/** Gold Greyhaven pays for one unit of a material (G1). Scrap is worth less. */
export const MATERIAL_SELL_PRICE: { readonly [materialId: string]: number } = {
  shard: 3,
  hide: 3,
  scrap: 2,
}

/** Half up, so 2.5 pays 3. */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5)
}

/** What Greyhaven pays for an item: `item level × 5 × quality`. */
export function itemSellPrice(item: ItemInstance): number {
  return roundHalfUp(item.itemLevel * 5 * item.quality)
}

/** What a new base item costs at 100% quality: `item level × 10`. */
export function itemBuyPrice(itemLevel: number): number {
  return itemLevel * 10
}

/** Gold to restore one item to full durability: `ceil(missing × (1 + item level ÷ 2) ÷ 10)`. */
export function repairCost(item: ItemInstance): number {
  const missing = item.maxDurability - item.durability
  if (missing <= 0) return 0
  return Math.ceil((missing * (1 + item.itemLevel / 2)) / 10)
}

export type ShopEntry = { baseId: string; name: string; itemLevel: number; price: number }

/** Every base item at the hero's level, in the order the content lists them. No supplies are sold. */
export function shopStock(heroLevel: number): ShopEntry[] {
  return Object.values(itemBases).map((base) => ({
    baseId: base.id,
    name: base.name,
    itemLevel: heroLevel,
    price: itemBuyPrice(heroLevel),
  }))
}
