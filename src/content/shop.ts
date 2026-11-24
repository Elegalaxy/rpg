import { classBlock, type ItemInstance, type Wearer } from '../sim/economy.ts'

import { implicitText, itemBases } from './items.ts'

/** Gold Greyhaven pays for one unit of a material (G1). Scrap is worth less. */
export const MATERIAL_SELL_PRICE: { readonly [materialId: string]: number } = {
  shard: 3,
  hide: 3,
  scrap: 2,
  witherbark: 4,
  oathsteel: 4,
  riftglass: 5,
  duskiron: 8,
  cinderite: 10,
}

/** Buying a material costs this many times what selling it pays (Step 13.28), so buying never undercuts selling. */
export const MATERIAL_BUY_MULTIPLIER = 5

/** The materials Greyhaven sells. The rare ones (riftglass, duskiron, cinderite) stay gated by exploring. */
export const BUYABLE_MATERIALS: readonly string[] = ['scrap', 'hide', 'shard', 'witherbark', 'oathsteel']

/** Gold Greyhaven charges for one unit of a buyable material. */
export const MATERIAL_BUY_PRICE: { readonly [materialId: string]: number } = Object.fromEntries(
  BUYABLE_MATERIALS.map((id) => [id, (MATERIAL_SELL_PRICE[id] ?? 0) * MATERIAL_BUY_MULTIPLIER]),
)

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

/** `implicit` is the accessory base's own stat line at the sold item level, or null. */
export type ShopEntry = { baseId: string; name: string; itemLevel: number; price: number; implicit: string | null }

/** Every base item the hero's class can use, at the hero's level, in the order the content lists them. No supplies are sold. */
export function shopStock(heroLevel: number, wearer?: Wearer): ShopEntry[] {
  return Object.values(itemBases)
    .filter((base) => !(base.type === 'accessory' && base.starterOnly === true))
    .filter((base) => wearer === undefined || classBlock(wearer, base) === null)
    .map((base) => ({
      baseId: base.id,
      name: base.name,
      itemLevel: heroLevel,
      price: itemBuyPrice(heroLevel),
      implicit: implicitText(base.id, heroLevel),
    }))
}
