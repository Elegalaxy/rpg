import type { ItemInstance } from '../../sim/economy.ts'

export type ItemGroup = { item: ItemInstance; count: number }

function keyOf(item: ItemInstance): string {
  return JSON.stringify([item.baseId, item.itemLevel, item.quality, item.durability, item.maxDurability, [...item.modifiers].sort(), item.heirloom ?? null])
}

/** Identical items (same base, level, quality, wear, modifiers) become one entry with a count. The first of each kind stands for the group. */
export function groupItems(items: readonly ItemInstance[]): ItemGroup[] {
  const groups = new Map<string, ItemGroup>()
  for (const item of items) {
    const key = keyOf(item)
    const found = groups.get(key)
    if (found === undefined) groups.set(key, { item, count: 1 })
    else found.count += 1
  }
  return [...groups.values()]
}

/** Names with repeats collapsed: ["Draught", "Draught", "Antidote"] becomes [["Draught", 2], ["Antidote", 1]]. */
export function countNames(names: readonly string[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
  return [...counts.entries()]
}
